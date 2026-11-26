import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExamFactoryService,
  ExamFactoryError,
  ExamFactoryInput,
  PostUtmeExamInput,
} from './exam-factory.service';
import {
  QuotaService,
  LEGACY_FREE_SESSION_CAP,
  PAYWALL_CODES,
} from '../quota/quota.service';
import { ExamExpiryService } from './exam-expiry.service';
import { ScoringService } from './scoring.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CacheService } from '../../cache/cache.service';
import { SettingsService } from '../settings/settings.service';
import { EventsService } from '../events/events.service';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { MarkReviewDto } from './dto/mark-review.dto';

type CreateExamInput =
  | { mode: 'MOCK'; subjectIds: string[]; proseTextId?: string }
  | { mode: 'PRACTICE'; subjectId: string; questionCount?: number }
  | { mode: 'TOPIC'; subjectId: string; topicId: string; questionCount?: number }
  | { mode: 'POST_UTME'; school: string; year?: number; questionCount?: number };

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examFactory: ExamFactoryService,
    private readonly examExpiry: ExamExpiryService,
    private readonly scoring: ScoringService,
    private readonly analyticsService: AnalyticsService,
    private readonly cache: CacheService,
    private readonly settings: SettingsService,
    private readonly quota: QuotaService,
    private readonly events: EventsService,
  ) {}

  // ─── POST /exams ──────────────────────────────────────────────────────────
  async createSession(userId: string, input: CreateExamInput) {
    // Seasonal gate: admins can close a whole exam group (e.g. switch off UTME
    // practice during Post-UTME season). Checked before any DB work so a closed
    // group fails fast with a clear, student-facing message.
    const availability = await this.settings.getExamAvailability();
    const isPostUtme = input.mode === 'POST_UTME';
    const groupOpen = isPostUtme ? availability.postUtme : availability.utme;
    if (!groupOpen) {
      throw new ForbiddenException(
        isPostUtme
          ? 'Post-UTME exams are currently turned off. Please check back soon.'
          : 'UTME practice exams are currently turned off. Please check back soon.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const isFree = user?.plan === 'FREE';

    if (isFree && (input.mode === 'MOCK' || input.mode === 'POST_UTME')) {
      this.events.record('quota_hit', userId, { reason: 'premium_mode', mode: input.mode });
      throw new HttpException(
        {
          message: 'Full mock exams and Post-UTME papers are part of Premium.',
          error: PAYWALL_CODES.premiumMode,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // A topic drill draws by topic, so the topic has to belong to the subject
    // it is filed under. Otherwise the session (and a free account's quota
    // check) would be booked against the wrong subject.
    if (input.mode === 'TOPIC') {
      const topic = await this.prisma.topic.findUnique({
        where: { id: input.topicId },
        select: { subjectId: true },
      });
      if (!topic) throw new NotFoundException('Topic not found');
      if (topic.subjectId !== input.subjectId) {
        throw new BadRequestException('That topic belongs to a different subject.');
      }
    }

    // Null while the admin switch is off; free accounts then keep the old
    // 20-a-session cap.
    const freeLimit = isFree ? await this.quota.freeLimit() : null;
    if (isFree && freeLimit === null && 'questionCount' in input && input.questionCount) {
      input.questionCount = Math.min(input.questionCount, LEGACY_FREE_SESSION_CAP);
    }

    let factoryInput: any;

    if (input.mode === 'MOCK') {
      factoryInput = { mode: 'MOCK', subjectIds: input.subjectIds, proseTextId: input.proseTextId };
    } else if (input.mode === 'PRACTICE') {
      factoryInput = { mode: 'PRACTICE', subjectId: input.subjectId, questionCount: input.questionCount ?? 40 };
    } else if (input.mode === 'TOPIC') {
      factoryInput = { mode: 'TOPIC', subjectId: input.subjectId, topicId: input.topicId, questionCount: input.questionCount ?? 20 };
    } else {
      // Post-UTME composition needs the user's UTME subject combination — without
      // it we can't build the subject-balanced paper the spec expects.
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId },
        select: {
          courseSubjectCombinations: { select: { subjectId: true } },
        },
      });
      const utmeSubjectIds =
        profile?.courseSubjectCombinations.map((c) => c.subjectId) ?? [];

      // English, Maths and General Knowledge are added automatically; the student
      // supplies 2–3 electives, so a combination of fewer than 2 is incomplete.
      if (utmeSubjectIds.length < 2) {
        throw new BadRequestException(
          'Set your UTME subject combination in your profile before taking a Post-UTME exam.',
        );
      }

      factoryInput = {
        mode: 'POST_UTME',
        school: input.school,
        year: input.year,
        questionCount: input.questionCount ?? 40,
        utmeSubjectIds,
      } satisfies PostUtmeExamInput;
    }

    try {
      return await this.startSession(userId, input, factoryInput, isFree, freeLimit);
    } catch (err) {
      if (err instanceof ExamFactoryError) {
        throw new HttpException(err.message, err.statusHint);
      }
      throw err;
    }
  }

  // Free accounts with the quota on go through the per-user lock.
  private async startSession(
    userId: string,
    input: CreateExamInput,
    factoryInput: any,
    isFree: boolean,
    freeLimit: number | null,
  ) {
    if (isFree && freeLimit !== null) {
      // Free accounts: count, draw and create under a per-user lock, so
      // sessions started at the same moment can't both spend the same
      // allowance.
      return await this.prisma.$transaction(
        async (tx) => {
          await this.quota.lockUser(tx, userId);
          // The subject's own free questions, then any referral bonus.
          const { remaining, bonusTotal } = await this.quota.allowance(userId, factoryInput.subjectId, freeLimit, tx);
          if (remaining <= 0) {
            this.events.record('quota_hit', userId, { reason: 'quota', mode: input.mode });
            throw new HttpException(
              {
                message: bonusTotal > 0
                  ? `You've used your ${freeLimit} free questions in this subject and your bonus questions. Premium unlocks every question.`
                  : `You've used your ${freeLimit} free questions in this subject. Premium unlocks every question.`,
                error: PAYWALL_CODES.quotaExhausted,
              },
              HttpStatus.PAYMENT_REQUIRED,
            );
          }
          // At most one subject's worth a session, so bonus questions are
          // spent ten at a time rather than all in one go.
          factoryInput.questionCount = Math.min(factoryInput.questionCount, remaining, freeLimit);
          factoryInput.excludeSeenBy = userId;
          return this.createFromFactory(userId, input, factoryInput, tx);
        },
        { timeout: 15_000 },
      );
    }
    return await this.createFromFactory(userId, input, factoryInput, this.prisma);
  }

  // Draws the questions and saves the session. `db` is the transaction when a
  // free account's quota lock is held, so the session is written under it.
  private async createFromFactory(
    userId: string,
    input: CreateExamInput,
    factoryInput: ExamFactoryInput,
    db: Prisma.TransactionClient | PrismaService,
  ) {
    const { questionIds, durationMinutes } = await this.examFactory.build(factoryInput, db);

    const examSession = await db.examSession.create({
      data: {
        userId,
        mode: input.mode,
        subjectId: 'subjectId' in input ? input.subjectId : undefined,
        topicId: 'topicId' in input ? input.topicId : undefined,
        school: 'school' in input ? input.school : undefined,
        totalQuestions: questionIds.length,
        durationMinutes,
        // expiresAt is set by POST /exams/:id/start when the user clicks Begin
        questions: {
          create: questionIds.map((qid, idx) => ({
            questionId: qid,
            position: idx,
          })),
        },
      },
      select: {
        id: true,
        mode: true,
        totalQuestions: true,
        durationMinutes: true,
        expiresAt: true,
        startedAt: true,
      },
    });

    return { examSession };
  }

  // ─── POST /exams/:id/start ────────────────────────────────────────────────
  async startExam(userId: string, id: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, durationMinutes: true, expiresAt: true, mode: true, totalQuestions: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException();
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Session is already ended');

    // Idempotent: if already started, return the existing expiry
    if (session.expiresAt) return { expiresAt: session.expiresAt };

    const expiresAt = new Date(Date.now() + session.durationMinutes * 60_000);
    // Only the request that actually starts the clock counts as a start, so
    // two taps on Begin record one funnel event. Students who open the
    // briefing and leave never get here.
    const { count } = await this.prisma.examSession.updateMany({ where: { id, expiresAt: null }, data: { expiresAt } });
    if (count === 0) {
      const current = await this.prisma.examSession.findUnique({ where: { id }, select: { expiresAt: true } });
      return { expiresAt: current?.expiresAt ?? expiresAt };
    }
    this.events.record('exam_start', userId, { mode: session.mode, questions: session.totalQuestions });
    return { expiresAt };
  }

  // ─── GET /exams/active ────────────────────────────────────────────────────
  async listActiveSessions(userId: string) {
    const sessions = await this.prisma.examSession.findMany({
      where: {
        userId,
        status: 'IN_PROGRESS',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        mode: true,
        status: true,
        totalQuestions: true,
        durationMinutes: true,
        startedAt: true,
        expiresAt: true,
        school: true,
        subjectId: true,
      },
    });
    return { sessions };
  }

  // ─── GET /exams ───────────────────────────────────────────────────────────
  async listSessions(userId: string, limit: number, offset: number) {
    const safeLimit = Math.min(limit, 50);
    const [sessions, total] = await Promise.all([
      this.prisma.examSession.findMany({
        where: { userId },
        take: safeLimit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          mode: true,
          status: true,
          totalQuestions: true,
          durationMinutes: true,
          startedAt: true,
          submittedAt: true,
          result: { select: { score: true, correct: true } },
        },
      }),
      this.prisma.examSession.count({ where: { userId } }),
    ]);

    return { sessions, total, limit: safeLimit, offset };
  }

  // ─── GET /exams/:id ───────────────────────────────────────────────────────
  async getSession(userId: string, sessionId: string) {
    const examSession = await this.prisma.examSession.findUnique({
      where: { id: sessionId, userId },
      select: {
        id: true,
        mode: true,
        status: true,
        totalQuestions: true,
        durationMinutes: true,
        expiresAt: true,
        startedAt: true,
        submittedAt: true,
        currentQuestion: true,
        // Set once the exam is submitted or timed out: lets the exam page send a returning student
        // straight to this exam's result.
        result: { select: { id: true } },
        questions: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            markedReview: true,
            question: {
              select: {
                id: true,
                text: true,
                imageUrl: true,
                subject: { select: { id: true, name: true, code: true } },
                topic: { select: { id: true, name: true } },
                options: {
                  select: { id: true, label: true, text: true, sortOrder: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        userAnswers: {
          select: { questionId: true, optionId: true },
        },
      },
    });

    if (!examSession) throw new NotFoundException('Exam session not found');

    // Inline expiry check (same as existing route)
    await this.examExpiry.resolveExamExpiry(
      sessionId,
      examSession.status,
      examSession.expiresAt,
    );

    return { examSession };
  }

  // ─── POST /exams/:id/answers ──────────────────────────────────────────────
  async saveAnswers(userId: string, sessionId: string, dto: SaveAnswersDto) {
    const examSession = await this.prisma.examSession.findUnique({
      where: { id: sessionId, userId, status: 'IN_PROGRESS' },
      select: { id: true, expiresAt: true, status: true },
    });

    if (!examSession) throw new NotFoundException('Active exam session not found');

    const expiry = await this.examExpiry.resolveExamExpiry(
      sessionId,
      examSession.status,
      examSession.expiresAt,
    );

    if (expiry.expired) throw new GoneException('Exam session has expired');

    const questionIds = dto.answers.map((a) => a.questionId);
    const options = await this.prisma.questionOption.findMany({
      where: { questionId: { in: questionIds }, isCorrect: true },
      select: { questionId: true, id: true },
    });
    const correctMap = new Map(options.map((o) => [o.questionId, o.id]));

    await this.prisma.$transaction(
      dto.answers.map((answer) => {
        const correctOptionId = correctMap.get(answer.questionId);
        const isCorrect =
          answer.optionId !== null
            ? answer.optionId === correctOptionId
            : null;

        return this.prisma.userAnswer.upsert({
          where: {
            examSessionId_questionId: {
              examSessionId: sessionId,
              questionId: answer.questionId,
            },
          },
          create: {
            examSessionId: sessionId,
            questionId: answer.questionId,
            optionId: answer.optionId,
            isCorrect,
          },
          update: {
            optionId: answer.optionId,
            isCorrect,
          },
        });
      }),
    );

    return { saved: dto.answers.length };
  }

  // ─── POST /exams/retry ────────────────────────────────────────────────────
  // A new session with just the questions missed (wrong or skipped) in one of
  // the student's results. They've all been served before, so retries don't
  // touch the free quota (see seenByUser) and are open to every plan.
  async createRetry(userId: string, resultId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      select: {
        userId: true,
        examSession: {
          select: {
            mode: true,
            subjectId: true,
            topicId: true,
            school: true,
            questions: { orderBy: { position: 'asc' }, select: { questionId: true } },
            userAnswers: { select: { questionId: true, isCorrect: true } },
          },
        },
      },
    });
    if (!result) throw new NotFoundException('Result not found');
    if (result.userId !== userId) throw new ForbiddenException();

    const availability = await this.settings.getExamAvailability();
    // A retry keeps its source's school (only Post-UTME papers have one), so a
    // retry of a retry still answers to the Post-UTME switch.
    const isPostUtme =
      result.examSession.mode === 'POST_UTME' ||
      (result.examSession.mode === 'RETRY' && result.examSession.school != null);
    if (!(isPostUtme ? availability.postUtme : availability.utme)) {
      throw new ForbiddenException('These exams are turned off right now. Please check back soon.');
    }

    const right = new Set(
      result.examSession.userAnswers.filter((a) => a.isCorrect === true).map((a) => a.questionId),
    );
    const missed = result.examSession.questions.map((q) => q.questionId).filter((id) => !right.has(id));
    if (missed.length === 0) {
      throw new BadRequestException('You got every question right, so there is nothing to retry.');
    }

    // Only questions that can still be answered (an admin may have unpublished
    // or flagged some since).
    const usable = new Set(
      (
        await this.prisma.question.findMany({
          where: {
            id: { in: missed },
            isPublished: true,
            isFlagged: false,
            // Comprehension questions need their passage, which the exam
            // screen doesn't show, so they're left out (as in the daily draw).
            proseTextId: null,
            options: { some: { isCorrect: true } },
          },
          select: { id: true },
        })
      ).map((q) => q.id),
    );
    const questionIds = missed.filter((id) => usable.has(id));
    if (questionIds.length === 0) {
      throw new HttpException('Those questions are no longer available.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const examSession = await this.prisma.examSession.create({
      data: {
        userId,
        mode: 'RETRY',
        subjectId: result.examSession.subjectId,
        topicId: result.examSession.topicId,
        school: result.examSession.school,
        totalQuestions: questionIds.length,
        durationMinutes: Math.max(5, Math.ceil(questionIds.length * 1.5)),
        questions: { create: questionIds.map((questionId, position) => ({ questionId, position })) },
      },
      select: { id: true, mode: true, totalQuestions: true, durationMinutes: true, expiresAt: true, startedAt: true },
    });
    return { examSession };
  }

  // ─── POST /exams/:id/submit ───────────────────────────────────────────────
  async submitExam(userId: string, sessionId: string) {
    const examSession = await this.prisma.examSession.findUnique({
      where: { id: sessionId, userId },
      select: { id: true, status: true, totalQuestions: true, expiresAt: true, mode: true },
    });

    if (!examSession) throw new NotFoundException('Exam session not found');

    if (examSession.status !== 'IN_PROGRESS') {
      throw new ConflictException('Exam has already been submitted');
    }

    const isTimedOut =
      examSession.expiresAt && new Date() > examSession.expiresAt;

    const [answers, userFlags] = await Promise.all([
      this.prisma.userAnswer.findMany({
        where: { examSessionId: sessionId },
        select: {
          questionId: true,
          isCorrect: true,
          question: {
            select: {
              subjectId: true,
              topicId: true,
              year: true,
              subject: { select: { id: true, name: true } },
              topic: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.questionFlag.findMany({
        where: {
          userId,
          question: {
            examSessionQuestions: { some: { examSessionId: sessionId } },
          },
        },
        select: { questionId: true },
      }),
    ]);

    const flaggedIds = new Set(userFlags.map((f) => f.questionId));
    const scorableAnswers = answers.filter(
      (a) => !flaggedIds.has(a.questionId),
    );
    const effectiveTotal = Math.max(
      examSession.totalQuestions - flaggedIds.size,
      0,
    );

    const { correct, incorrect, unanswered, score, subjectBreakdown, topicBreakdown } =
      this.scoring.computeScore(scorableAnswers, effectiveTotal);

    // Per-paper-year tallies feed the past-paper leaderboards.
    const yearTally = new Map<number, { correct: number; total: number }>();
    for (const a of scorableAnswers) {
      if (a.question.year == null) continue;
      const tally = yearTally.get(a.question.year) ?? { correct: 0, total: 0 };
      tally.total++;
      if (a.isCorrect) tally.correct++;
      yearTally.set(a.question.year, tally);
    }

    // Interactive transaction: resultId needed for child rows
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.examSession.update({
        where: { id: sessionId },
        data: {
          status: isTimedOut ? 'TIMED_OUT' : 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      const newResult = await tx.result.create({
        data: {
          examSessionId: sessionId,
          userId,
          totalQuestions: examSession.totalQuestions,
          correct,
          incorrect,
          unanswered,
          score,
          subjectBreakdown: subjectBreakdown.reduce((acc, s) => ({ ...acc, [s.subjectId]: s }), {}),
          topicBreakdown: topicBreakdown.reduce((acc, t) => ({ ...acc, [t.topicId]: t }), {}),
        },
      });

      await Promise.all([
        subjectBreakdown.length > 0 &&
          tx.resultSubjectBreakdown.createMany({
            data: subjectBreakdown.map((s) => ({
              resultId: newResult.id,
              subjectId: s.subjectId,
              name: s.name,
              correct: s.correct,
              total: s.total,
            })),
          }),
        topicBreakdown.length > 0 &&
          tx.resultTopicBreakdown.createMany({
            data: topicBreakdown.map((t) => ({
              resultId: newResult.id,
              topicId: t.topicId,
              name: t.name,
              correct: t.correct,
              total: t.total,
            })),
          }),
        yearTally.size > 0 &&
          tx.resultYearBreakdown.createMany({
            data: [...yearTally].map(([year, t]) => ({
              resultId: newResult.id,
              userId,
              year,
              correct: t.correct,
              total: t.total,
            })),
          }),
      ]);

      return newResult;
    });

    // New result means analytics and results list are stale — bust both caches.
    void this.analyticsService.invalidateCache(userId);
    void this.cache.delByPrefix(`results:list:${userId}:`);
    this.events.record('exam_finish', userId, { mode: examSession.mode, score: Math.round(result.score) });

    return { result };
  }

  // ─── PATCH /exams/:id/review ──────────────────────────────────────────────
  async toggleReview(
    userId: string,
    sessionId: string,
    dto: MarkReviewDto,
  ) {
    const examSession = await this.prisma.examSession.findUnique({
      where: { id: sessionId, userId, status: 'IN_PROGRESS' },
      select: { id: true },
    });

    if (!examSession) throw new NotFoundException('Active exam session not found');

    await this.prisma.examSessionQuestion.update({
      where: {
        examSessionId_questionId: {
          examSessionId: sessionId,
          questionId: dto.questionId,
        },
      },
      data: { markedReview: dto.markedReview },
    });

    return { questionId: dto.questionId, markedReview: dto.markedReview };
  }
}
