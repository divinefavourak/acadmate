import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, ForbiddenException, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMockExamDto, UpdateMockExamDto, AddParticipantDto, BulkAddParticipantsDto,
  RegisterParticipantDto, LoginParticipantDto, UploadQuestionsDto,
  SaveAnswerDto, PanicReportDto,
} from './dto';
import { MockParticipantPayload } from './guards/mock-participant.guard';

const MAX_ATTEMPTS = 2;

interface QuestionOption { label: string; text: string; isCorrect: boolean }

@Injectable()
export class MockExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Admin: mock exam CRUD ────────────────────────────────────────────────

  async listMockExams() {
    return this.prisma.mockExam.findMany({
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { participants: true, questions: true, sessions: true } } },
    });
  }

  async getMockExam(id: string) {
    const exam = await this.prisma.mockExam.findUnique({
      where: { id },
      include: { _count: { select: { participants: true, questions: true, sessions: true } } },
    });
    if (!exam) throw new NotFoundException('Mock exam not found');
    return exam;
  }

  async createMockExam(dto: CreateMockExamDto) {
    return this.prisma.mockExam.create({
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        durationMinutes: dto.durationMinutes,
      },
    });
  }

  async updateMockExam(id: string, dto: UpdateMockExamDto) {
    await this.getMockExam(id);
    return this.prisma.mockExam.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startsAt && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt && { endsAt: new Date(dto.endsAt) }),
        ...(dto.durationMinutes && { durationMinutes: dto.durationMinutes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteMockExam(id: string) {
    await this.getMockExam(id);
    await this.prisma.mockExam.delete({ where: { id } });
  }

  // ── Admin: participants ──────────────────────────────────────────────────

  async listParticipants(mockExamId: string) {
    await this.getMockExam(mockExamId);
    const rows = await this.prisma.mockExamParticipant.findMany({
      where: { mockExamId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sessions: true } } },
    });
    return rows.map(({ pinHash, ...rest }) => ({ ...rest, isRegistered: pinHash !== null }));
  }

  async addParticipant(mockExamId: string, dto: AddParticipantDto) {
    await this.getMockExam(mockExamId);
    const phone = dto.phone.trim();
    const existing = await this.prisma.mockExamParticipant.findUnique({
      where: { mockExamId_phone: { mockExamId, phone } },
    });
    if (existing) throw new ConflictException('Phone number already added');
    return this.prisma.mockExamParticipant.create({
      data: { mockExamId, phone, name: dto.name, isApproved: true },
    });
  }

  async addParticipants(mockExamId: string, dto: BulkAddParticipantsDto) {
    await this.getMockExam(mockExamId);
    const phones = [...new Set(dto.phones.map((p) => p.trim()).filter(Boolean))];
    const existing = await this.prisma.mockExamParticipant.findMany({
      where: { mockExamId, phone: { in: phones } },
      select: { phone: true },
    });
    const existingSet = new Set(existing.map((p) => p.phone));
    const newPhones = phones.filter((p) => !existingSet.has(p));
    if (newPhones.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.mockExamParticipant.createMany({
          data: newPhones.map((phone) => ({ mockExamId, phone, isApproved: true })),
        });
      });
    }
    return { added: newPhones.length, skipped: phones.length - newPhones.length };
  }

  async setParticipantApproval(participantId: string, isApproved: boolean) {
    const p = await this.prisma.mockExamParticipant.findUnique({ where: { id: participantId } });
    if (!p) throw new NotFoundException('Participant not found');
    return this.prisma.mockExamParticipant.update({
      where: { id: participantId },
      data: { isApproved },
    });
  }

  async removeParticipant(participantId: string) {
    const p = await this.prisma.mockExamParticipant.findUnique({ where: { id: participantId } });
    if (!p) throw new NotFoundException('Participant not found');
    await this.prisma.mockExamParticipant.delete({ where: { id: participantId } });
  }

  // ── Admin: questions ─────────────────────────────────────────────────────

  async listQuestions(mockExamId: string) {
    await this.getMockExam(mockExamId);
    return this.prisma.mockExamQuestion.findMany({
      where: { mockExamId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async uploadQuestions(mockExamId: string, dto: UploadQuestionsDto) {
    await this.getMockExam(mockExamId);
    const activeSessions = await this.prisma.mockExamSession.count({
      where: { mockExamId, status: 'IN_PROGRESS' },
    });
    if (activeSessions > 0) {
      throw new BadRequestException('Cannot replace questions while sessions are in progress');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.mockExamQuestion.deleteMany({ where: { mockExamId } });
      const created = await tx.mockExamQuestion.createMany({
        data: dto.questions.map((q, i) => ({
          mockExamId,
          text: q.text,
          imageUrl: q.imageUrl,
          options: q.options as unknown as object,
          subject: q.subject,
          explanation: q.explanation,
          sortOrder: i,
        })),
      });
      return { count: created.count };
    });
  }

  async deleteQuestion(questionId: string) {
    const q = await this.prisma.mockExamQuestion.findUnique({ where: { id: questionId } });
    if (!q) throw new NotFoundException('Question not found');
    await this.prisma.mockExamQuestion.delete({ where: { id: questionId } });
  }

  // ── Admin: results & panics ──────────────────────────────────────────────

  async listResults(mockExamId: string) {
    await this.getMockExam(mockExamId);
    const sessions = await this.prisma.mockExamSession.findMany({
      where: { mockExamId },
      include: { participant: { select: { id: true, phone: true, name: true } } },
      orderBy: [{ score: 'desc' }, { submittedAt: 'asc' }],
    });
    return sessions.map((s) => ({
      ...s,
      durationSeconds: s.submittedAt
        ? Math.floor((s.submittedAt.getTime() - s.startedAt.getTime()) / 1000)
        : null,
    }));
  }

  async listPanics(mockExamId: string) {
    await this.getMockExam(mockExamId);
    return this.prisma.mockPanicReport.findMany({
      where: { mockExamId },
      include: {
        participant: { select: { id: true, phone: true, name: true } },
        session: { select: { id: true, attemptNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolvePanic(panicId: string, isResolved: boolean) {
    const p = await this.prisma.mockPanicReport.findUnique({ where: { id: panicId } });
    if (!p) throw new NotFoundException('Panic report not found');
    return this.prisma.mockPanicReport.update({ where: { id: panicId }, data: { isResolved } });
  }

  async countUnresolvedPanics(mockExamId: string) {
    return this.prisma.mockPanicReport.count({ where: { mockExamId, isResolved: false } });
  }

  // ── Public: active exam info ─────────────────────────────────────────────

  async getActiveMockExam() {
    const exam = await this.prisma.mockExam.findFirst({
      where: { isActive: true },
      include: { _count: { select: { questions: true } } },
    });
    if (!exam) throw new NotFoundException('No active mock exam');
    return this.publicExamShape(exam);
  }

  async getPublicMockExam(id: string) {
    const exam = await this.prisma.mockExam.findUnique({
      where: { id, isActive: true },
      include: { _count: { select: { questions: true } } },
    });
    if (!exam) throw new NotFoundException('Exam not found or not active');
    return this.publicExamShape(exam);
  }

  private publicExamShape(exam: { id: string; title: string; description: string | null; startsAt: Date; endsAt: Date; durationMinutes: number; _count: { questions: number } }) {
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
      durationMinutes: exam.durationMinutes,
      questionCount: exam._count.questions,
    };
  }

  // ── Public: participant register / login ─────────────────────────────────

  async registerParticipant(mockExamId: string, dto: RegisterParticipantDto) {
    const phone = dto.phone.trim();

    if (!/^\d{4}$/.test(dto.pin)) {
      throw new BadRequestException('PIN must be exactly 4 digits');
    }

    const participant = await this.prisma.mockExamParticipant.findUnique({
      where: { mockExamId_phone: { mockExamId, phone } },
    });

    if (!participant) throw new ForbiddenException('Phone number not on the approved list');
    if (!participant.isApproved) throw new ForbiddenException('Your registration has not been approved yet');
    if (participant.pinHash) throw new ConflictException('Already registered — please log in');

    const pinHash = await bcrypt.hash(dto.pin, 10);
    return this.prisma.mockExamParticipant.update({
      where: { id: participant.id },
      data: { name: dto.name, pinHash },
      select: { id: true, phone: true, name: true },
    });
  }

  async loginParticipant(mockExamId: string, dto: LoginParticipantDto) {
    const phone = dto.phone.trim();
    const participant = await this.prisma.mockExamParticipant.findUnique({
      where: { mockExamId_phone: { mockExamId, phone } },
    });

    if (!participant || !participant.pinHash) {
      throw new UnauthorizedException();
    }
    if (!participant.isApproved) throw new ForbiddenException('Access not approved');

    const valid = await bcrypt.compare(dto.pin, participant.pinHash);
    if (!valid) throw new UnauthorizedException('Incorrect PIN');

    const payload: MockParticipantPayload = {
      sub: participant.id,
      mockExamId,
      type: 'MOCK_PARTICIPANT',
    };

    return {
      accessToken: this.jwt.sign(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: '12h',
      }),
      participant: { id: participant.id, name: participant.name, phone: participant.phone },
    };
  }

  // ── Public: exam session ─────────────────────────────────────────────────

  async startSession(participantId: string, mockExamId: string) {
    const participant = await this.prisma.mockExamParticipant.findUnique({
      where: { id: participantId },
      include: { sessions: true },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    const completedAttempts = participant.sessions.filter(
      (s) => s.status === 'SUBMITTED' || s.status === 'TIMED_OUT',
    );

    if (completedAttempts.length >= MAX_ATTEMPTS) {
      throw new ForbiddenException(`Maximum ${MAX_ATTEMPTS} attempts reached`);
    }

    // Block if there's already an in-progress session
    const inProgress = participant.sessions.find((s) => s.status === 'IN_PROGRESS');
    if (inProgress) {
      // Return the existing session instead of creating a new one
      return this.getSessionWithQuestions(inProgress.id);
    }

    const attemptNumber = completedAttempts.length + 1;
    const exam = await this.prisma.mockExam.findUnique({ where: { id: mockExamId } });
    if (!exam) throw new NotFoundException('Mock exam not found');

    const session = await this.prisma.mockExamSession.create({
      data: { mockExamId, participantId, attemptNumber, total: 0 },
    });

    // Pre-create answer slots for all questions
    const questions = await this.prisma.mockExamQuestion.findMany({
      where: { mockExamId },
      orderBy: { sortOrder: 'asc' },
    });

    await this.prisma.mockExamAnswer.createMany({
      data: questions.map((q) => ({ sessionId: session.id, questionId: q.id })),
    });

    await this.prisma.mockExamSession.update({
      where: { id: session.id },
      data: { total: questions.length },
    });

    return this.getSessionWithQuestions(session.id);
  }

  async getSessionWithQuestions(sessionId: string) {
    const session = await this.prisma.mockExamSession.findUnique({
      where: { id: sessionId },
      include: {
        mockExam: { select: { durationMinutes: true, title: true, endsAt: true } },
        answers: { select: { questionId: true, selected: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    const questions = await this.prisma.mockExamQuestion.findMany({
      where: { mockExamId: session.mockExamId },
      orderBy: { sortOrder: 'asc' },
    });

    // Strip isCorrect from options before sending to client
    const sanitisedQuestions = questions.map((q) => ({
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl,
      subject: q.subject,
      options: (q.options as unknown as QuestionOption[]).map(({ label, text }) => ({ label, text })),
    }));

    const savedAnswers: Record<string, string | null> = {};
    for (const a of session.answers) {
      savedAnswers[a.questionId] = a.selected ?? null;
    }

    return {
      sessionId: session.id,
      attemptNumber: session.attemptNumber,
      status: session.status,
      startedAt: session.startedAt,
      durationMinutes: session.mockExam.durationMinutes,
      examTitle: session.mockExam.title,
      examEndsAt: session.mockExam.endsAt,
      questions: sanitisedQuestions,
      savedAnswers,
    };
  }

  async saveAnswer(sessionId: string, participantId: string, dto: SaveAnswerDto) {
    const session = await this.prisma.mockExamSession.findUnique({ where: { id: sessionId } });
    if (!session || session.participantId !== participantId) throw new NotFoundException('Session not found');
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Session already submitted');

    await this.prisma.mockExamAnswer.upsert({
      where: { sessionId_questionId: { sessionId, questionId: dto.questionId } },
      update: { selected: dto.selected ?? null },
      create: { sessionId, questionId: dto.questionId, selected: dto.selected ?? null },
    });
    return { ok: true };
  }

  async submitSession(sessionId: string, participantId: string) {
    const session = await this.prisma.mockExamSession.findUnique({
      where: { id: sessionId },
      include: { answers: true },
    });
    if (!session || session.participantId !== participantId) throw new NotFoundException('Session not found');
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('Session already submitted');

    const questions = await this.prisma.mockExamQuestion.findMany({
      where: { mockExamId: session.mockExamId },
    });

    let correct = 0;
    const answerUpdates: Promise<unknown>[] = [];

    for (const answer of session.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question || !answer.selected) continue;
      const opts = question.options as unknown as QuestionOption[];
      const chosen = opts.find((o) => o.label === answer.selected);
      const isCorrect = chosen?.isCorrect ?? false;
      if (isCorrect) correct++;
      answerUpdates.push(
        this.prisma.mockExamAnswer.update({
          where: { id: answer.id },
          data: { isCorrect },
        }),
      );
    }

    await Promise.all(answerUpdates);

    const total = questions.length;
    const score = total > 0 ? (correct / total) * 100 : 0;

    return this.prisma.mockExamSession.update({
      where: { id: sessionId },
      data: { status: 'SUBMITTED', submittedAt: new Date(), score, correct, total },
    });
  }

  async timeoutSession(sessionId: string) {
    const session = await this.prisma.mockExamSession.findUnique({
      where: { id: sessionId },
      include: { answers: true },
    });
    if (!session || session.status !== 'IN_PROGRESS') return;

    const questions = await this.prisma.mockExamQuestion.findMany({
      where: { mockExamId: session.mockExamId },
    });

    let correct = 0;
    for (const answer of session.answers) {
      if (!answer.selected) continue;
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) continue;
      const opts = question.options as unknown as QuestionOption[];
      const isCorrect = opts.find((o) => o.label === answer.selected)?.isCorrect ?? false;
      if (isCorrect) correct++;
    }

    const total = questions.length;
    const score = total > 0 ? (correct / total) * 100 : 0;

    return this.prisma.mockExamSession.update({
      where: { id: sessionId },
      data: { status: 'TIMED_OUT', submittedAt: new Date(), score, correct, total },
    });
  }

  async getSessionResult(sessionId: string, participantId: string) {
    const session = await this.prisma.mockExamSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: { include: { question: true } },
        participant: { select: { name: true, phone: true } },
        mockExam: { select: { title: true } },
      },
    });
    if (!session || session.participantId !== participantId) throw new NotFoundException('Session not found');
    if (session.status === 'IN_PROGRESS') throw new BadRequestException('Session not yet submitted');

    // Per-subject breakdown
    const subjectMap: Record<string, { correct: number; total: number }> = {};
    for (const answer of session.answers) {
      const subject = answer.question.subject;
      if (!subjectMap[subject]) subjectMap[subject] = { correct: 0, total: 0 };
      subjectMap[subject].total++;
      if (answer.isCorrect) subjectMap[subject].correct++;
    }

    // Answered with correct option shown
    const reviewAnswers = session.answers.map((a) => {
      const opts = a.question.options as unknown as QuestionOption[];
      const correctLabel = opts.find((o) => o.isCorrect)?.label ?? null;
      return {
        questionId: a.questionId,
        text: a.question.text,
        subject: a.question.subject,
        options: opts.map(({ label, text }) => ({ label, text })),
        selected: a.selected,
        correctLabel,
        isCorrect: a.isCorrect,
        explanation: a.question.explanation,
      };
    });

    return {
      sessionId,
      attemptNumber: session.attemptNumber,
      status: session.status,
      score: session.score,
      correct: session.correct,
      total: session.total,
      timeTakenSeconds: session.submittedAt
        ? Math.round((session.submittedAt.getTime() - session.startedAt.getTime()) / 1000)
        : null,
      participant: session.participant,
      examTitle: session.mockExam.title,
      subjectBreakdown: subjectMap,
      answers: reviewAnswers,
    };
  }

  // ── Public: panic report ─────────────────────────────────────────────────

  async sendPanicReport(participantId: string, mockExamId: string, dto: PanicReportDto) {
    return this.prisma.mockPanicReport.create({
      data: {
        mockExamId,
        participantId,
        sessionId: dto.sessionId ?? null,
        message: dto.message,
      },
    });
  }

  // ── Public: leaderboard ──────────────────────────────────────────────────

  async getLeaderboard(mockExamId: string) {
    const sessions = await this.prisma.mockExamSession.findMany({
      where: { mockExamId, status: { in: ['SUBMITTED', 'TIMED_OUT'] } },
      include: { participant: { select: { id: true, name: true, phone: true } } },
    });

    // Best score per participant; tiebreak by fastest time
    const best = new Map<string, typeof sessions[0]>();
    for (const s of sessions) {
      const prev = best.get(s.participantId);
      if (!prev) { best.set(s.participantId, s); continue; }
      const prevScore = prev.score ?? 0;
      const curScore = s.score ?? 0;
      if (curScore > prevScore) { best.set(s.participantId, s); continue; }
      if (curScore === prevScore && s.submittedAt && prev.submittedAt) {
        const prevTime = prev.submittedAt.getTime() - prev.startedAt.getTime();
        const curTime = s.submittedAt.getTime() - s.startedAt.getTime();
        if (curTime < prevTime) best.set(s.participantId, s);
      }
    }

    const ranked = [...best.values()].sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      // Tiebreak: faster completion
      const aTime = a.submittedAt ? a.submittedAt.getTime() - a.startedAt.getTime() : Infinity;
      const bTime = b.submittedAt ? b.submittedAt.getTime() - b.startedAt.getTime() : Infinity;
      return aTime - bTime;
    });

    return ranked.map((s, i) => ({
      rank: i + 1,
      participantId: s.participantId,
      name: s.participant.name ?? s.participant.phone,
      score: s.score,
      correct: s.correct,
      total: s.total,
      timeTakenSeconds: s.submittedAt
        ? Math.round((s.submittedAt.getTime() - s.startedAt.getTime()) / 1000)
        : null,
      attemptNumber: s.attemptNumber,
    }));
  }
}

