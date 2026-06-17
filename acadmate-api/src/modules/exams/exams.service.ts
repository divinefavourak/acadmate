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
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExamFactoryService,
  ExamFactoryError,
  PostUtmeExamInput,
} from './exam-factory.service';
import { ExamExpiryService } from './exam-expiry.service';
import { ScoringService } from './scoring.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CacheService } from '../../cache/cache.service';
import { SettingsService } from '../settings/settings.service';
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

    if (user?.plan === 'FREE') {
      if (input.mode === 'MOCK' || input.mode === 'POST_UTME') {
        throw new HttpException(
          'MOCK and Post-UTME exams require a Premium plan. Redeem an access code to unlock full access.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const count = (input as any).questionCount;
      if (typeof count === 'number' && count > 20) {
        (input as any).questionCount = 20;
      }
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
      const { questionIds, durationMinutes } =
        await this.examFactory.build(factoryInput);

      const examSession = await this.prisma.examSession.create({
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
    } catch (err) {
      if (err instanceof ExamFactoryError) {
        throw new HttpException(err.message, err.statusHint);
      }
      throw err;
    }
  }

  // ─── POST /exams/:id/start ────────────────────────────────────────────────
  async startExam(userId: string, id: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, durationMinutes: true, expiresAt: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException();
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Session is already ended');

    // Idempotent: if already started, return the existing expiry
    if (session.expiresAt) return { expiresAt: session.expiresAt };

    const expiresAt = new Date(Date.now() + session.durationMinutes * 60_000);
    await this.prisma.examSession.update({ where: { id }, data: { expiresAt } });
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

  // ─── POST /exams/:id/submit ───────────────────────────────────────────────
  async submitExam(userId: string, sessionId: string) {
    const examSession = await this.prisma.examSession.findUnique({
      where: { id: sessionId, userId },
      select: { id: true, status: true, totalQuestions: true, expiresAt: true },
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
      ]);

      return newResult;
    });

    // New result means analytics and results list are stale — bust both caches.
    void this.analyticsService.invalidateCache(userId);
    void this.cache.delByPrefix(`results:list:${userId}:`);

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
