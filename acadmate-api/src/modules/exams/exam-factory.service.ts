import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ─── UTME constants (preserved exactly) ──────────────────────────────────────
const UTME_ENGLISH_QUESTIONS = 30;
const UTME_PROSE_QUESTIONS = 10;
const UTME_SUBJECT_QUESTIONS = 40;
const UTME_DURATION_MINUTES = 120;
const ENGLISH_CODE = 'ENG';

const POST_UTME_DEFAULT_QUESTIONS = 40;
const POST_UTME_DURATION_MINUTES = 30;

// Post-UTME composition: English + Math + General Knowledge + 3 UTME subjects.
// Splits are tuned for a 40-question paper; the factory takes whatever is
// available for each subject and only errors if the combined total is too low.
const POST_UTME_SPLIT = {
  ENG: 10,
  MTH: 10,
  GEN: 5,
  UTME_PER_SUBJECT: 5,
} as const;
const POST_UTME_MIN_QUESTIONS = 10;

// ─── Input types (identical to original lib/services/exam-factory.ts) ─────────
export type MockExamInput = {
  mode: 'MOCK';
  subjectIds: string[];
  proseTextId?: string;
};

export type PracticeExamInput = {
  mode: 'PRACTICE';
  subjectId: string;
  questionCount: number;
};

export type TopicExamInput = {
  mode: 'TOPIC';
  subjectId: string;
  topicId: string;
  questionCount: number;
};

export type PostUtmeExamInput = {
  mode: 'POST_UTME';
  school: string;
  year?: number;
  questionCount: number;
  utmeSubjectIds: string[];
};

export type ExamFactoryInput =
  | MockExamInput
  | PracticeExamInput
  | TopicExamInput
  | PostUtmeExamInput;

export type ExamFactoryResult = {
  questionIds: string[];
  durationMinutes: number;
};

// ─── Error (preserves statusHint for HTTP response mapping) ─────────────────
export class ExamFactoryError extends Error {
  constructor(
    message: string,
    public readonly statusHint: 400 | 422 | 500 = 422,
  ) {
    super(message);
    this.name = 'ExamFactoryError';
  }
}

@Injectable()
export class ExamFactoryService {
  constructor(private readonly prisma: PrismaService) {}

  async build(input: ExamFactoryInput): Promise<ExamFactoryResult> {
    switch (input.mode) {
      case 'MOCK':
        return this.buildMock(input);
      case 'PRACTICE':
        return this.buildPractice(input);
      case 'TOPIC':
        return this.buildTopic(input);
      case 'POST_UTME':
        return this.buildPostUtme(input);
    }
  }

  private async buildMock(input: MockExamInput): Promise<ExamFactoryResult> {
    const english = await this.prisma.subject.findFirst({
      where: { code: ENGLISH_CODE, isActive: true },
      select: { id: true },
    });

    if (!english) {
      throw new ExamFactoryError(
        'Use of English subject is not configured in the system',
        500,
      );
    }

    if (input.subjectIds.includes(english.id)) {
      throw new ExamFactoryError(
        'Use of English is included automatically — please select 3 other subjects',
        400,
      );
    }

    let proseId = input.proseTextId ?? null;
    if (!proseId) {
      const randomProse = await this.prisma.proseText.findFirst({
        where: { isPublished: true },
        select: { id: true },
      });
      proseId = randomProse?.id ?? null;
    }

    const [engRows, proseRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT q.id FROM questions q
        WHERE q."subjectId" = ${english.id}
          AND q."isPublished" = true
          AND q."isFlagged" = false
          AND q."proseTextId" IS NULL
          AND EXISTS (
            SELECT 1 FROM question_options qo
            WHERE qo."questionId" = q.id AND qo."isCorrect" = true
          )
        ORDER BY RANDOM()
        LIMIT ${UTME_ENGLISH_QUESTIONS}
      `,
      proseId
        ? this.prisma.$queryRaw<{ id: string }[]>`
            SELECT q.id FROM questions q
            WHERE q."proseTextId" = ${proseId}
              AND q."isPublished" = true
              AND q."isFlagged" = false
              AND EXISTS (
                SELECT 1 FROM question_options qo
                WHERE qo."questionId" = q.id AND qo."isCorrect" = true
              )
            ORDER BY RANDOM()
            LIMIT ${UTME_PROSE_QUESTIONS}
          `
        : Promise.resolve<{ id: string }[]>([]),
    ]);

    const subjectBatches = await Promise.all(
      input.subjectIds.map((sid) =>
        this.prisma.$queryRaw<{ id: string }[]>`
          SELECT q.id FROM questions q
          WHERE q."subjectId" = ${sid}
            AND q."isPublished" = true
            AND q."isFlagged" = false
            AND EXISTS (
              SELECT 1 FROM question_options qo
              WHERE qo."questionId" = q.id AND qo."isCorrect" = true
            )
          ORDER BY RANDOM()
          LIMIT ${UTME_SUBJECT_QUESTIONS}
        `,
      ),
    );

    const questionIds = [
      ...fisherYates(engRows.map((r) => r.id)),
      ...fisherYates(proseRows.map((r) => r.id)),
      ...subjectBatches.flatMap((batch) => fisherYates(batch.map((r) => r.id))),
    ];

    if (questionIds.length === 0) {
      throw new ExamFactoryError(
        'No questions available for the selected subjects',
        422,
      );
    }

    return { questionIds, durationMinutes: UTME_DURATION_MINUTES };
  }

  private async buildPractice(
    input: PracticeExamInput,
  ): Promise<ExamFactoryResult> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT q.id FROM questions q
      WHERE q."subjectId" = ${input.subjectId}
        AND q."isPublished" = true
        AND q."isFlagged" = false
        AND EXISTS (
          SELECT 1 FROM question_options qo
          WHERE qo."questionId" = q.id AND qo."isCorrect" = true
        )
      ORDER BY RANDOM()
      LIMIT ${input.questionCount}
    `;

    const questionIds = fisherYates(rows.map((r) => r.id));

    if (questionIds.length === 0) {
      throw new ExamFactoryError(
        'No questions available for this selection',
        422,
      );
    }

    return { questionIds, durationMinutes: input.questionCount * 2 };
  }

  private async buildTopic(input: TopicExamInput): Promise<ExamFactoryResult> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT q.id FROM questions q
      WHERE q."topicId" = ${input.topicId}
        AND q."isPublished" = true
        AND q."isFlagged" = false
        AND EXISTS (
          SELECT 1 FROM question_options qo
          WHERE qo."questionId" = q.id AND qo."isCorrect" = true
        )
      ORDER BY RANDOM()
      LIMIT ${input.questionCount}
    `;

    const questionIds = fisherYates(rows.map((r) => r.id));

    if (questionIds.length === 0) {
      throw new ExamFactoryError(
        'No questions available for this selection',
        422,
      );
    }

    return { questionIds, durationMinutes: input.questionCount * 2 };
  }

  private async buildPostUtme(
    input: PostUtmeExamInput,
  ): Promise<ExamFactoryResult> {
    // Resolve the fixed-by-code subjects (English, Math, General Knowledge).
    // GEN may not be seeded yet — missing fixed subjects are silently skipped
    // so the feature still ships a useful paper.
    const fixed = await this.prisma.subject.findMany({
      where: { code: { in: ['ENG', 'MTH', 'GEN'] }, isActive: true },
      select: { id: true, code: true },
    });
    const fixedById = new Map(fixed.map((s) => [s.code, s.id]));

    const buckets: { subjectId: string; limit: number }[] = [];
    const engId = fixedById.get('ENG');
    const mthId = fixedById.get('MTH');
    const genId = fixedById.get('GEN');
    if (engId) buckets.push({ subjectId: engId, limit: POST_UTME_SPLIT.ENG });
    if (mthId) buckets.push({ subjectId: mthId, limit: POST_UTME_SPLIT.MTH });
    if (genId) buckets.push({ subjectId: genId, limit: POST_UTME_SPLIT.GEN });

    // UTME combination subjects — skip any that overlap with ENG/MTH/GEN
    // (a student picking Math as one of their three would otherwise double-count).
    const fixedIds = new Set(buckets.map((b) => b.subjectId));
    for (const sid of input.utmeSubjectIds) {
      if (fixedIds.has(sid)) continue;
      buckets.push({ subjectId: sid, limit: POST_UTME_SPLIT.UTME_PER_SUBJECT });
    }

    const yearFilter = input.year ?? null;

    const batches = await Promise.all(
      buckets.map(({ subjectId, limit }) =>
        yearFilter != null
          ? this.prisma.$queryRaw<{ id: string }[]>`
              SELECT q.id FROM questions q
              WHERE q."school" = ${input.school}
                AND q."examType" = 'POST_UTME'::"ExamType"
                AND q."year" = ${yearFilter}
                AND q."subjectId" = ${subjectId}
                AND q."isPublished" = true
                AND q."isFlagged" = false
                AND EXISTS (
                  SELECT 1 FROM question_options qo
                  WHERE qo."questionId" = q.id AND qo."isCorrect" = true
                )
              ORDER BY RANDOM()
              LIMIT ${limit}
            `
          : this.prisma.$queryRaw<{ id: string }[]>`
              SELECT q.id FROM questions q
              WHERE q."school" = ${input.school}
                AND q."examType" = 'POST_UTME'::"ExamType"
                AND q."subjectId" = ${subjectId}
                AND q."isPublished" = true
                AND q."isFlagged" = false
                AND EXISTS (
                  SELECT 1 FROM question_options qo
                  WHERE qo."questionId" = q.id AND qo."isCorrect" = true
                )
              ORDER BY RANDOM()
              LIMIT ${limit}
            `,
      ),
    );

    const collected = batches.flatMap((batch) => batch.map((r) => r.id));

    if (collected.length < POST_UTME_MIN_QUESTIONS) {
      throw new ExamFactoryError(
        `Not enough Post-UTME questions for "${input.school}"${input.year ? ` (${input.year})` : ''} ` +
          `with your subject combination. Found ${collected.length} — need at least ${POST_UTME_MIN_QUESTIONS}.`,
        422,
      );
    }

    const questionIds = fisherYates(collected);
    return { questionIds, durationMinutes: POST_UTME_DURATION_MINUTES };
  }
}

// ─── Fisher-Yates shuffle (identical to original) ─────────────────────────────
function fisherYates<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
