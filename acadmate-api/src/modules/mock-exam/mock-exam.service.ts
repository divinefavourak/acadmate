import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, ForbiddenException, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMockExamDto, UpdateMockExamDto, AddParticipantDto, BulkAddParticipantsDto,
  RegisterParticipantDto, LoginParticipantDto, UploadQuestionsDto,
  SaveAnswerDto, PanicReportDto,
} from './dto';
import { MockParticipantPayload } from './guards/mock-participant.guard';

const MAX_ATTEMPTS = 2;

// Total questions served in a single attempt, sampled across the candidate's
// chosen subjects (English + GK + Maths + electives). The pool can be far larger
// (admins upload everything); each attempt draws a balanced 40-question paper.
const TOTAL_QUESTIONS_PER_ATTEMPT = 40;

// Slugs share the /mock/:idOrSlug URL space with these subpaths/words, so they
// can't be used as a slug.
const RESERVED_SLUGS = new Set([
  'active', 'register', 'login', 'exam', 'subjects', 'leaderboard',
  'result', 'info', 'sessions', 'panic', 'current', 'new',
]);

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface QuestionOption { label: string; text: string; isCorrect: boolean }

// Mock papers store each question's subject as free text. These patterns flag the
// three subjects that are compulsory for every participant (English, Mathematics,
// General Knowledge); anything else is an elective the participant chooses from.
const COMPULSORY_SUBJECT_PATTERNS: RegExp[] = [
  /english/i,
  /math/i,
  /general\s*knowledge|^\s*gk\s*$/i,
];

function isCompulsorySubject(subject: string): boolean {
  return COMPULSORY_SUBJECT_PATTERNS.some((re) => re.test(subject));
}

// ── Deterministic per-session shuffling ──────────────────────────────────────
// Questions and their options are randomised per session so no two participants
// see the same order, yet a given session always reproduces the same layout
// (stable across refresh/resume, and reproducible at scoring time).

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Shuffle a question's options for a session and re-label them A/B/C/D by their
// new position, so the correct letter differs per participant and "it's B" can't
// be shared. The same (sessionId, questionId) always yields the same ordering,
// which is what lets scoring re-derive the mapping.
function shuffleOptionsForSession(
  sessionId: string,
  questionId: string,
  options: QuestionOption[],
): QuestionOption[] {
  return seededShuffle(options, hashSeed(`${sessionId}:${questionId}`)).map((o, i) => ({
    ...o,
    label: OPTION_LABELS[i] ?? o.label,
  }));
}

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

  // Normalise + validate a slug, rejecting reserved words and bad lengths.
  private cleanSlug(input: string): string {
    const slug = normalizeSlug(input);
    if (slug.length < 3 || slug.length > 60) {
      throw new BadRequestException('Slug must be 3–60 characters (letters, numbers, hyphens).');
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new BadRequestException(`"${slug}" is a reserved word — please choose another slug.`);
    }
    return slug;
  }

  // id wins over slug at resolution, so a slug equal to another exam's id would
  // silently route to that exam — reject it.
  private async ensureSlugNotAnExamId(slug: string, currentExamId?: string) {
    const match = await this.prisma.mockExam.findUnique({
      where: { id: slug },
      select: { id: true },
    });
    if (match && match.id !== currentExamId) {
      throw new BadRequestException('That slug matches an existing exam ID — please choose another.');
    }
  }

  async createMockExam(dto: CreateMockExamDto) {
    const slug = dto.slug ? this.cleanSlug(dto.slug) : undefined;
    if (slug) await this.ensureSlugNotAnExamId(slug);
    try {
      return await this.prisma.mockExam.create({
        data: {
          title: dto.title,
          slug,
          description: dto.description,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          durationMinutes: dto.durationMinutes,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('That slug is already taken.');
      }
      throw e;
    }
  }

  async updateMockExam(id: string, dto: UpdateMockExamDto) {
    await this.getMockExam(id);
    // undefined = leave unchanged; "" = clear; otherwise set a validated slug.
    let slugUpdate: { slug?: string | null } = {};
    if (dto.slug !== undefined) {
      const nextSlug = dto.slug.trim() === '' ? null : this.cleanSlug(dto.slug);
      if (nextSlug) await this.ensureSlugNotAnExamId(nextSlug, id);
      slugUpdate = { slug: nextSlug };
    }
    try {
      return await this.prisma.mockExam.update({
        where: { id },
        data: {
          ...(dto.title && { title: dto.title }),
          ...slugUpdate,
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.startsAt && { startsAt: new Date(dto.startsAt) }),
          ...(dto.endsAt && { endsAt: new Date(dto.endsAt) }),
          ...(dto.durationMinutes && { durationMinutes: dto.durationMinutes }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('That slug is already taken.');
      }
      throw e;
    }
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
    const append = dto.mode === 'append';
    const activeSessions = await this.prisma.mockExamSession.count({
      where: { mockExamId, status: 'IN_PROGRESS' },
    });
    if (activeSessions > 0) {
      throw new BadRequestException(
        `Cannot ${append ? 'add' : 'replace'} questions while sessions are in progress`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      if (!append) {
        await tx.mockExamQuestion.deleteMany({ where: { mockExamId } });
      }
      // When appending, continue numbering after the current highest sortOrder.
      const offset = append
        ? ((await tx.mockExamQuestion.aggregate({
            where: { mockExamId },
            _max: { sortOrder: true },
          }))._max.sortOrder ?? -1) + 1
        : 0;
      const created = await tx.mockExamQuestion.createMany({
        data: dto.questions.map((q, i) => ({
          mockExamId,
          text: q.text,
          imageUrl: q.imageUrl,
          options: q.options as unknown as object,
          subject: q.subject,
          explanation: q.explanation,
          sortOrder: offset + i,
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

  async getPublicMockExam(idOrSlug: string) {
    // Look up by id first, then slug, so a slug that happens to equal another
    // exam's id can never shadow it (id always wins — deterministic).
    const include = { _count: { select: { questions: true } } };
    const exam =
      (await this.prisma.mockExam.findUnique({ where: { id: idOrSlug }, include })) ??
      (await this.prisma.mockExam.findUnique({ where: { slug: idOrSlug }, include }));
    if (!exam || !exam.isActive) throw new NotFoundException('Exam not found or not active');
    return this.publicExamShape(exam);
  }

  // Resolve a public /mock/:idOrSlug param to the real exam id (slugs are
  // human-friendly aliases for the cuid). id is matched first, deterministically.
  private async resolveExamId(idOrSlug: string): Promise<string> {
    const exam =
      (await this.prisma.mockExam.findUnique({ where: { id: idOrSlug }, select: { id: true } })) ??
      (await this.prisma.mockExam.findUnique({ where: { slug: idOrSlug }, select: { id: true } }));
    if (!exam) throw new NotFoundException('Mock exam not found');
    return exam.id;
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

  async registerParticipant(idOrSlug: string, dto: RegisterParticipantDto) {
    const mockExamId = await this.resolveExamId(idOrSlug);
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
    const avatar = this.resolveAvatar(dto.avatarConfig, dto.avatarUrl);
    return this.prisma.mockExamParticipant.update({
      where: { id: participant.id },
      data: { name: dto.name, pinHash, ...avatar },
      select: { id: true, phone: true, name: true },
    });
  }

  // Validate and normalise participant avatar input. An uploaded photo wins over
  // a generated config (one-of), images are capped/type-checked, and generated
  // configs are size-bounded — clients are untrusted.
  private resolveAvatar(
    avatarConfig: Record<string, unknown> | undefined,
    avatarUrl: string | undefined,
  ): { avatarConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull; avatarUrl: string | null } {
    if (avatarUrl) {
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(avatarUrl)) {
        throw new BadRequestException('Invalid avatar image format.');
      }
      // ~500 KB decoded — uploads are downscaled to a small thumbnail client-side.
      if (avatarUrl.length > 700_000) {
        throw new BadRequestException('Avatar image is too large.');
      }
      return { avatarConfig: Prisma.JsonNull, avatarUrl };
    }
    if (avatarConfig) {
      if (JSON.stringify(avatarConfig).length > 4_000) {
        throw new BadRequestException('Invalid avatar configuration.');
      }
      return { avatarConfig: avatarConfig as Prisma.InputJsonValue, avatarUrl: null };
    }
    return { avatarConfig: Prisma.JsonNull, avatarUrl: null };
  }

  async loginParticipant(idOrSlug: string, dto: LoginParticipantDto) {
    const mockExamId = await this.resolveExamId(idOrSlug);
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

  /**
   * Distinct subjects in a mock paper, split into the compulsory three
   * (English / Maths / General Knowledge) and the electives a participant
   * chooses 2–3 of. Used to render the pre-exam subject picker.
   */
  async getMockSubjects(mockExamId: string, participantId?: string) {
    const rows = await this.prisma.mockExamQuestion.findMany({
      where: { mockExamId },
      select: { subject: true },
      distinct: ['subject'],
      orderBy: { subject: 'asc' },
    });

    const compulsory: string[] = [];
    const electives: string[] = [];
    for (const { subject } of rows) {
      (isCompulsorySubject(subject) ? compulsory : electives).push(subject);
    }

    // When ≤2 electives exist there's nothing meaningful to choose — they're all
    // included automatically. Otherwise the participant picks 2–3.
    const maxElectives = Math.min(3, electives.length);
    const minElectives = electives.length <= 2 ? electives.length : 2;

    // On a retake the picker is skipped: surface the electives chosen in the most
    // recent completed attempt so the page can show (locked) and start directly.
    let previousElectives: string[] | null = null;
    if (participantId) {
      const last = await this.prisma.mockExamSession.findFirst({
        where: { participantId, status: { in: ['SUBMITTED', 'TIMED_OUT'] } },
        orderBy: { attemptNumber: 'desc' },
        select: { subjects: true },
      });
      if (last && last.subjects.length > 0) {
        previousElectives = last.subjects.filter((s) => !isCompulsorySubject(s));
      }
    }

    return { compulsory, electives, minElectives, maxElectives, previousElectives };
  }

  /** Returns the participant's in-progress session (with questions) or null. */
  async getCurrentSession(participantId: string) {
    const inProgress = await this.prisma.mockExamSession.findFirst({
      where: { participantId, status: 'IN_PROGRESS' },
    });
    if (!inProgress) return null;
    return this.getSessionWithQuestions(inProgress.id);
  }

  async startSession(
    participantId: string,
    mockExamId: string,
    selectedElectives?: string[],
  ) {
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

    // Block if there's already an in-progress session — return it as-is, keeping
    // the subjects chosen when it was first started.
    const inProgress = participant.sessions.find((s) => s.status === 'IN_PROGRESS');
    if (inProgress) {
      return this.getSessionWithQuestions(inProgress.id);
    }

    const attemptNumber = completedAttempts.length + 1;
    const exam = await this.prisma.mockExam.findUnique({ where: { id: mockExamId } });
    if (!exam) throw new NotFoundException('Mock exam not found');

    // Resolve the subject set. A retake reuses the subjects from the most recent
    // completed attempt, so the participant doesn't pick again. The first attempt
    // takes compulsory subjects + the 2–3 electives chosen (auto-included when ≤2).
    const lastCompleted = [...completedAttempts].sort(
      (a, b) => b.attemptNumber - a.attemptNumber,
    )[0];

    let sessionSubjects: string[];
    if (lastCompleted && lastCompleted.subjects.length > 0) {
      sessionSubjects = lastCompleted.subjects;
    } else {
      const { compulsory, electives, minElectives, maxElectives } =
        await this.getMockSubjects(mockExamId);

      let chosenElectives: string[];
      if (electives.length <= 2) {
        chosenElectives = electives;
      } else {
        const requested = (selectedElectives ?? []).filter((s) => electives.includes(s));
        const unique = [...new Set(requested)];
        if (unique.length < minElectives || unique.length > maxElectives) {
          throw new BadRequestException(
            `Please pick ${minElectives === maxElectives ? minElectives : `${minElectives}–${maxElectives}`} elective subjects.`,
          );
        }
        chosenElectives = unique;
      }
      sessionSubjects = [...compulsory, ...chosenElectives];
    }

    const pool = await this.prisma.mockExamQuestion.findMany({
      where: { mockExamId, subject: { in: sessionSubjects } },
      orderBy: { sortOrder: 'asc' },
    });
    if (pool.length === 0) {
      throw new BadRequestException('No questions available for the selected subjects.');
    }

    // Build a balanced TOTAL_QUESTIONS_PER_ATTEMPT paper across the chosen subjects.
    // Shuffle each subject, then round-robin draft one at a time so the 40 are spread
    // as evenly as the pool allows (and still reach 40 if a subject runs short). The
    // selected set is persisted via the answer slots below and is what every
    // read/score path uses, so a candidate gets a fixed 40, not the whole bank.
    const bySubject = new Map<string, typeof pool>();
    for (const q of pool) {
      const arr = bySubject.get(q.subject ?? '') ?? [];
      arr.push(q);
      bySubject.set(q.subject ?? '', arr);
    }
    const queues = [...bySubject.values()].map((arr) =>
      seededShuffle(arr, Math.floor(Math.random() * 2 ** 31)),
    );
    const questions: typeof pool = [];
    let progressed = true;
    while (questions.length < TOTAL_QUESTIONS_PER_ATTEMPT && progressed) {
      progressed = false;
      for (const queue of queues) {
        if (questions.length >= TOTAL_QUESTIONS_PER_ATTEMPT) break;
        const next = queue.shift();
        if (next) {
          questions.push(next);
          progressed = true;
        }
      }
    }

    let session;
    try {
      session = await this.prisma.mockExamSession.create({
        data: {
          mockExamId,
          participantId,
          attemptNumber,
          total: questions.length,
          subjects: sessionSubjects,
        },
      });
    } catch (e) {
      // A concurrent request (e.g. double-clicked "Begin") may have created the
      // session first, tripping @@unique([participantId, attemptNumber]). Return
      // that in-progress session instead of surfacing the constraint error.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.mockExamSession.findFirst({
          where: { participantId, status: 'IN_PROGRESS' },
        });
        if (existing) return this.getSessionWithQuestions(existing.id);
      }
      throw e;
    }

    // Pre-create answer slots only for the questions in this attempt's subjects.
    await this.prisma.mockExamAnswer.createMany({
      data: questions.map((q) => ({ sessionId: session.id, questionId: q.id })),
    });

    return this.getSessionWithQuestions(session.id);
  }

  /**
   * Question filter for a session. Empty `subjects` (legacy sessions created
   * before per-subject selection) means "the whole paper".
   */
  private sessionQuestionWhere(mockExamId: string, subjects: string[]) {
    return subjects.length > 0
      ? { mockExamId, subject: { in: subjects } }
      : { mockExamId };
  }

  /**
   * The exact questions belonging to a session. The pre-created answer slots are
   * the source of truth (each attempt samples a capped subset), so we resolve by
   * their questionIds. Legacy sessions with no answer rows fall back to the whole
   * paper by subject.
   */
  private questionsForSession(session: {
    mockExamId: string;
    subjects: string[];
    answers: { questionId: string }[];
  }) {
    const ids = session.answers.map((a) => a.questionId);
    if (ids.length > 0) {
      return this.prisma.mockExamQuestion.findMany({
        where: { id: { in: ids } },
        orderBy: { sortOrder: 'asc' },
      });
    }
    return this.prisma.mockExamQuestion.findMany({
      where: this.sessionQuestionWhere(session.mockExamId, session.subjects),
      orderBy: { sortOrder: 'asc' },
    });
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

    const questions = await this.questionsForSession(session);

    // Randomise question order per session, and option order per question, then
    // strip isCorrect before sending to the client.
    const orderedQuestions = seededShuffle(questions, hashSeed(session.id));
    const sanitisedQuestions = orderedQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl,
      subject: q.subject,
      options: shuffleOptionsForSession(session.id, q.id, q.options as unknown as QuestionOption[])
        .map(({ label, text }) => ({ label, text })),
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

    const questions = await this.questionsForSession(session);

    let correct = 0;
    const answerUpdates: Promise<unknown>[] = [];

    for (const answer of session.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question || !answer.selected) continue;
      // Re-derive the same per-session option shuffle to map the chosen label back.
      const opts = shuffleOptionsForSession(sessionId, question.id, question.options as unknown as QuestionOption[]);
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

    const questions = await this.questionsForSession(session);

    let correct = 0;
    for (const answer of session.answers) {
      if (!answer.selected) continue;
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) continue;
      const opts = shuffleOptionsForSession(sessionId, question.id, question.options as unknown as QuestionOption[]);
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

    // Reorder answers to match the shuffled order the participant saw (sort by
    // sortOrder first to mirror getSessionWithQuestions, then apply the same seed),
    // and re-derive each question's shuffled option labels.
    const orderedAnswers = seededShuffle(
      [...session.answers].sort((a, b) => a.question.sortOrder - b.question.sortOrder),
      hashSeed(session.id),
    );
    const reviewAnswers = orderedAnswers.map((a) => {
      const opts = shuffleOptionsForSession(session.id, a.questionId, a.question.options as unknown as QuestionOption[]);
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

  async getLeaderboard(idOrSlug: string) {
    const mockExamId = await this.resolveExamId(idOrSlug);
    const sessions = await this.prisma.mockExamSession.findMany({
      where: { mockExamId, status: { in: ['SUBMITTED', 'TIMED_OUT'] } },
      include: { participant: { select: { id: true, name: true, phone: true, avatarConfig: true, avatarUrl: true } } },
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
      avatarConfig: s.participant.avatarConfig,
      avatarUrl: s.participant.avatarUrl,
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

