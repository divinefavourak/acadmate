import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LiveSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExamFactoryError,
  ExamFactoryService,
} from '../exams/exam-factory.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';

// 6-char human-readable code, ambiguous characters (0/O/1/I/L) removed so it
// can be read aloud or copied from a whiteboard without confusion.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join('');
}

@Injectable()
export class LiveSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examFactory: ExamFactoryService,
  ) {}

  // ─── POST /live-sessions (admin) ──────────────────────────────────────────
  async create(adminId: string, dto: CreateLiveSessionDto) {
    // Retry on the (astronomically unlikely) code collision.
    let code = generateCode();
    for (let attempt = 0; attempt < 8; attempt++) {
      const clash = await this.prisma.liveSession.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!clash) break;
      code = generateCode();
    }

    const session = await this.prisma.liveSession.create({
      data: {
        code,
        title: dto.title?.trim() || null,
        mode: dto.mode ?? 'MOCK',
        subjectIds: dto.subjectIds ?? [],
        durationMinutes: dto.durationMinutes ?? 60,
        questionCount: dto.questionCount ?? 40,
        createdById: adminId,
      },
    });

    return { session };
  }

  // ─── GET /live-sessions (admin) ───────────────────────────────────────────
  async list(adminId: string) {
    const sessions = await this.prisma.liveSession.findMany({
      where: { createdById: adminId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { examSessions: true } },
      },
    });

    // Count submitted papers per session in one grouped query.
    const submittedCounts = await this.prisma.examSession.groupBy({
      by: ['liveSessionId'],
      where: {
        liveSessionId: { in: sessions.map((s) => s.id) },
        status: { in: ['SUBMITTED', 'TIMED_OUT'] },
      },
      _count: { _all: true },
    });
    const submittedById = new Map(
      submittedCounts.map((c) => [c.liveSessionId, c._count._all]),
    );

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        code: s.code,
        title: s.title,
        status: s.status,
        mode: s.mode,
        durationMinutes: s.durationMinutes,
        questionCount: s.questionCount,
        createdAt: s.createdAt,
        endsAt: s.endsAt,
        joinedCount: s._count.examSessions,
        submittedCount: submittedById.get(s.id) ?? 0,
      })),
    };
  }

  // ─── PATCH /live-sessions/:code/status (admin) ────────────────────────────
  async updateStatus(
    adminId: string,
    code: string,
    status: LiveSessionStatus,
  ) {
    const session = await this.prisma.liveSession.findUnique({
      where: { code },
      select: { id: true, createdById: true, durationMinutes: true, status: true },
    });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.createdById !== adminId) throw new ForbiddenException();

    // Defence-in-depth: the DTO already restricts this, but never let an
    // unexpected value through to the DB.
    if (status !== 'ACTIVE' && status !== 'ENDED') {
      throw new BadRequestException('A live session can only be set to ACTIVE or ENDED.');
    }

    // Idempotent: re-sending the current status (retry / double-click) must not
    // recompute endsAt and shift an already-set window.
    if (session.status === status) {
      const current = await this.prisma.liveSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      return { session: current };
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: session.id },
      data: {
        status,
        // Stamp the window-close time so the dashboard and join page can show
        // when the session went live / wrapped up.
        endsAt:
          status === 'ENDED'
            ? new Date()
            : new Date(Date.now() + session.durationMinutes * 60_000),
      },
    });

    return { session: updated };
  }

  // ─── GET /live-sessions/:code (public — student join page) ─────────────────
  async getPublic(code: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { code },
      select: {
        code: true,
        title: true,
        status: true,
        mode: true,
        durationMinutes: true,
        questionCount: true,
        subjectIds: true,
        endsAt: true,
      },
    });
    if (!session) throw new NotFoundException('Live session not found');

    const subjects = await this.resolveSubjectNames(session.subjectIds);
    const joinedCount = await this.prisma.examSession.count({
      where: { liveSession: { code } },
    });

    return {
      session: {
        code: session.code,
        title: session.title,
        status: session.status,
        mode: session.mode,
        durationMinutes: session.durationMinutes,
        questionCount: session.questionCount,
        subjects,
        joinedCount,
        endsAt: session.endsAt,
      },
    };
  }

  // ─── POST /live-sessions/:code/join (student) ─────────────────────────────
  async join(userId: string, code: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { code },
      select: {
        id: true,
        status: true,
        mode: true,
        subjectIds: true,
        durationMinutes: true,
        questionCount: true,
      },
    });
    if (!session) throw new NotFoundException('Live session not found');

    if (session.status === 'ENDED') {
      throw new GoneException('This live session has ended.');
    }
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException(
        'This live session has not started yet. Please wait for your tutor to begin.',
      );
    }

    // One attempt per student per session, regardless of status: a student who
    // refreshes resumes their in-progress paper, and one who already submitted
    // is sent back to that paper (the exam page forwards finished papers to the
    // results screen) — they can't fork a second attempt or retake.
    const existing = await this.prisma.examSession.findFirst({
      where: { liveSessionId: session.id, userId },
      select: { id: true },
    });
    if (existing) return { examSessionId: existing.id, resumed: true };

    try {
      const { questionIds } = await this.examFactory.build({
        mode: 'LIVE',
        subjectIds: session.subjectIds,
        questionCount: session.questionCount,
      });

      const examSession = await this.prisma.examSession.create({
        data: {
          userId,
          liveSessionId: session.id,
          mode: session.mode,
          totalQuestions: questionIds.length,
          durationMinutes: session.durationMinutes,
          questions: {
            create: questionIds.map((qid, idx) => ({
              questionId: qid,
              position: idx,
            })),
          },
        },
        select: { id: true },
      });

      return { examSessionId: examSession.id, resumed: false };
    } catch (err) {
      // Lost a concurrent race — the @@unique([liveSessionId, userId]) index
      // rejected the duplicate. Return whichever attempt won.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await this.prisma.examSession.findFirst({
          where: { liveSessionId: session.id, userId },
          select: { id: true },
        });
        if (winner) return { examSessionId: winner.id, resumed: true };
      }
      if (err instanceof ExamFactoryError) {
        throw new HttpException(err.message, err.statusHint);
      }
      throw err;
    }
  }

  // ─── DELETE /live-sessions/:code (admin) ──────────────────────────────────
  // Removes a stale session. Student papers survive: the ExamSession →
  // LiveSession relation is onDelete: SetNull, so attempts detach (and stay in
  // each student's history) rather than being destroyed. An ACTIVE session is
  // never "stale" and yanking it mid-exam would break in-progress papers, so it
  // must be ended first.
  async remove(adminId: string, code: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { code },
      select: { id: true, createdById: true, status: true },
    });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.createdById !== adminId) throw new ForbiddenException();

    if (session.status === 'ACTIVE') {
      throw new BadRequestException(
        'End this live session before deleting it.',
      );
    }

    await this.prisma.liveSession.delete({ where: { id: session.id } });
    return { deleted: true };
  }

  // ─── GET /live-sessions/:code/results (admin — polled ~10s) ───────────────
  async getResults(adminId: string, code: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        mode: true,
        durationMinutes: true,
        questionCount: true,
        subjectIds: true,
        createdById: true,
        endsAt: true,
        createdAt: true,
      },
    });
    if (!session) throw new NotFoundException('Live session not found');
    if (session.createdById !== adminId) throw new ForbiddenException();

    const examSessions = await this.prisma.examSession.findMany({
      where: { liveSessionId: session.id },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        status: true,
        totalQuestions: true,
        startedAt: true,
        submittedAt: true,
        expiresAt: true,
        user: { select: { id: true, name: true, image: true } },
        result: {
          select: { score: true, correct: true, incorrect: true, unanswered: true },
        },
      },
    });

    // Answered counts for in-progress papers, fetched in a single grouped query.
    const inProgressIds = examSessions
      .filter((e) => e.status === 'IN_PROGRESS')
      .map((e) => e.id);

    const answeredCounts = inProgressIds.length
      ? await this.prisma.userAnswer.groupBy({
          by: ['examSessionId'],
          where: {
            examSessionId: { in: inProgressIds },
            optionId: { not: null },
          },
          _count: { _all: true },
        })
      : [];
    const answeredById = new Map(
      answeredCounts.map((a) => [a.examSessionId, a._count._all]),
    );

    const participants = examSessions.map((e) => ({
      examSessionId: e.id,
      user: e.user,
      status: e.status,
      totalQuestions: e.totalQuestions,
      answered:
        e.status === 'IN_PROGRESS'
          ? (answeredById.get(e.id) ?? 0)
          : e.result
            ? e.result.correct + e.result.incorrect
            : 0,
      score: e.result?.score ?? null,
      correct: e.result?.correct ?? null,
      startedAt: e.startedAt,
      submittedAt: e.submittedAt,
      expiresAt: e.expiresAt,
    }));

    // Only truly completed papers count as "submitted" — ABANDONED attempts are
    // neither in-progress nor a real result, so they're excluded from both.
    const completed = participants.filter(
      (p) => p.status === 'SUBMITTED' || p.status === 'TIMED_OUT',
    );
    const inProgressCount = participants.filter(
      (p) => p.status === 'IN_PROGRESS',
    ).length;
    const scores = completed
      .map((p) => p.score)
      .filter((s): s is number => s !== null);
    const averageScore = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

    const subjects = await this.resolveSubjectNames(session.subjectIds);

    return {
      session: {
        id: session.id,
        code: session.code,
        title: session.title,
        status: session.status,
        mode: session.mode,
        durationMinutes: session.durationMinutes,
        questionCount: session.questionCount,
        subjects,
        endsAt: session.endsAt,
        createdAt: session.createdAt,
      },
      stats: {
        joined: participants.length,
        inProgress: inProgressCount,
        submitted: completed.length,
        averageScore,
      },
      participants,
    };
  }

  // Maps subject ids to display rows, tolerating ids that no longer resolve.
  private async resolveSubjectNames(subjectIds: string[]) {
    if (subjectIds.length === 0) return [] as { id: string; name: string }[];
    const rows = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.name]));
    return subjectIds.map((id) => ({ id, name: byId.get(id) ?? 'Unknown' }));
  }
}
