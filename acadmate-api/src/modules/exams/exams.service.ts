import {
  Injectable,
  NotFoundException,
  ConflictException,
  GoneException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExamFactoryService,
  ExamFactoryError,
} from './exam-factory.service';
import { ExamExpiryService } from './exam-expiry.service';
import { ScoringService } from './scoring.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { MarkReviewDto } from './dto/mark-review.dto';

type CreateExamInput =
  | { mode: 'MOCK'; subjectIds: string[]; proseTextId?: string }
  | { mode: 'PRACTICE'; subjectId: string; questionCount?: number }
  | { mode: 'TOPIC'; subjectId: string; topicId: string; questionCount?: number };

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examFactory: ExamFactoryService,
    private readonly examExpiry: ExamExpiryService,
    private readonly scoring: ScoringService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ─── POST /exams ──────────────────────────────────────────────────────────
  async createSession(userId: string, input: CreateExamInput) {
    let factoryInput: any;

    if (input.mode === 'MOCK') {
      factoryInput = { mode: 'MOCK', subjectIds: input.subjectIds, proseTextId: input.proseTextId };
    } else if (input.mode === 'PRACTICE') {
      factoryInput = { mode: 'PRACTICE', subjectId: input.subjectId, questionCount: input.questionCount ?? 40 };
    } else {
      factoryInput = { mode: 'TOPIC', subjectId: input.subjectId, topicId: input.topicId, questionCount: input.questionCount ?? 20 };
    }

    try {
      const { questionIds, durationMinutes } =
        await this.examFactory.build(factoryInput);

      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      const examSession = await this.prisma.examSession.create({
        data: {
          userId,
          mode: input.mode,
          subjectId: 'subjectId' in input ? input.subjectId : undefined,
          topicId: 'topicId' in input ? input.topicId : undefined,
          totalQuestions: questionIds.length,
          durationMinutes,
          expiresAt,
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

    // New result means analytics are stale — bust the cache immediately.
    this.analyticsService.invalidateCache(userId);

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
