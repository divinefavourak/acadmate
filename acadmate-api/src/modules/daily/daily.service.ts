import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EventsService } from '../events/events.service';
import { computeStreak, lagosDay, lagosDayStart, Streak } from '../../common/utils/lagos-day.util';

// Five questions a day, outside the free quota: English plus the student's
// own UTME subjects, questions they haven't had before where possible.
export const DAILY_QUESTIONS = 5;
const DAILY_MINUTES = 8;
const ENGLISH_CODE = 'ENG';

export interface DailyStatus {
  /** Lagos day, "YYYY-MM-DD". */
  date: string;
  questionCount: number;
  durationMinutes: number;
  state: 'NEW' | 'IN_PROGRESS' | 'DONE';
  sessionId: string | null;
  resultId: string | null;
  correct: number | null;
  total: number | null;
  streak: Streak & { freezes: boolean };
}

@Injectable()
export class DailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
  ) {}

  async status(userId: string): Promise<DailyStatus> {
    const today = lagosDay();
    const [session, streak] = await Promise.all([
      this.todaysSession(userId, today, this.prisma),
      this.streak(userId),
    ]);
    const result = session?.result ?? null;
    return {
      date: today,
      questionCount: session?.totalQuestions ?? DAILY_QUESTIONS,
      durationMinutes: session?.durationMinutes ?? DAILY_MINUTES,
      state: !session ? 'NEW' : result ? 'DONE' : 'IN_PROGRESS',
      sessionId: session?.id ?? null,
      resultId: result?.id ?? null,
      correct: result?.correct ?? null,
      total: result?.totalQuestions ?? null,
      streak,
    };
  }

  /** Today's challenge session, created on first call. Safe to call twice. */
  async start(userId: string): Promise<{ sessionId: string }> {
    const availability = await this.settings.getExamAvailability();
    if (!availability.utme) {
      throw new ForbiddenException('Practice is turned off right now. Please check back soon.');
    }
    const today = lagosDay();

    return this.prisma.$transaction(
      async (tx) => {
        // Two taps on "Start" must not make two challenges.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'daily:' + userId}))`;
        const existing = await this.todaysSession(userId, today, tx);
        if (existing) return { sessionId: existing.id };

        const questionIds = await this.draw(userId, tx);
        if (questionIds.length === 0) {
          throw new HttpException('No questions are available for the daily challenge yet.', HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const session = await tx.examSession.create({
          data: {
            userId,
            mode: 'DAILY',
            totalQuestions: questionIds.length,
            durationMinutes: DAILY_MINUTES,
            questions: { create: questionIds.map((questionId, position) => ({ questionId, position })) },
          },
          select: { id: true },
        });
        this.events.record('exam_start', userId, { mode: 'DAILY' });
        return { sessionId: session.id };
      },
      { timeout: 15_000 },
    );
  }

  /** Streak from the days the student finished any exam. Premium gets freezes. */
  async streak(userId: string): Promise<Streak & { freezes: boolean }> {
    const [user, rows] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
      // createdAt is stored as UTC without a zone; convert to a Lagos date.
      this.prisma.$queryRaw<{ d: string }[]>`
        SELECT DISTINCT to_char((r."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS d
        FROM results r
        WHERE r."userId" = ${userId} AND r."createdAt" > now() - interval '800 days'
      `,
    ]);
    const freezes = user?.plan === 'PREMIUM';
    return { ...computeStreak(new Set(rows.map((r) => r.d)), lagosDay(), freezes), freezes };
  }

  private todaysSession(userId: string, today: string, db: Prisma.TransactionClient | PrismaService) {
    return db.examSession.findFirst({
      where: { userId, mode: 'DAILY', createdAt: { gte: lagosDayStart(today) } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalQuestions: true,
        durationMinutes: true,
        result: { select: { id: true, correct: true, totalQuestions: true } },
      },
    });
  }

  /**
   * English first, then the student's subjects in random order, one question
   * each, round and round until there are five. Within a subject, questions the
   * student has never been given come first. Comprehension questions are left
   * out because they need their passage.
   */
  private async draw(userId: string, tx: Prisma.TransactionClient): Promise<string[]> {
    const [english, profile] = await Promise.all([
      tx.subject.findFirst({ where: { code: ENGLISH_CODE, isActive: true }, select: { id: true } }),
      tx.studentProfile.findUnique({
        where: { userId },
        select: { courseSubjectCombinations: { select: { subjectId: true } } },
      }),
    ]);
    let others = (profile?.courseSubjectCombinations ?? [])
      .map((c) => c.subjectId)
      .filter((id) => id !== english?.id);
    if (others.length === 0) {
      // No combination set: any active subject.
      const all = await tx.subject.findMany({ where: { isActive: true, id: { not: english?.id } }, select: { id: true } });
      others = all.map((s) => s.id);
    }
    const order = [...(english ? [english.id] : []), ...shuffle([...new Set(others)])];

    const pools = new Map<string, string[]>();
    for (const subjectId of order) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT q.id FROM questions q
        WHERE q."subjectId" = ${subjectId}
          AND q."isPublished" = true
          AND q."isFlagged" = false
          AND q."proseTextId" IS NULL
          AND q."examType" IS DISTINCT FROM 'POST_UTME'::"ExamType"
          AND EXISTS (SELECT 1 FROM question_options qo WHERE qo."questionId" = q.id AND qo."isCorrect" = true)
        ORDER BY
          EXISTS (
            SELECT 1 FROM exam_session_questions esq
            JOIN exam_sessions es ON es.id = esq."examSessionId"
            WHERE es."userId" = ${userId} AND esq."questionId" = q.id
          ),
          RANDOM()
        LIMIT ${DAILY_QUESTIONS}
      `;
      pools.set(subjectId, rows.map((r) => r.id));
    }

    const picked: string[] = [];
    for (let round = 0; picked.length < DAILY_QUESTIONS && round < DAILY_QUESTIONS; round++) {
      for (const subjectId of order) {
        const id = pools.get(subjectId)?.[round];
        if (id && picked.length < DAILY_QUESTIONS) picked.push(id);
      }
    }
    return picked;
  }
}

function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
