import type { PrismaClient } from "@prisma/client";

// ─── UTME constants ───────────────────────────────────────────────────────────
const UTME_ENGLISH_QUESTIONS = 30;
const UTME_PROSE_QUESTIONS = 10;
const UTME_SUBJECT_QUESTIONS = 40;
const UTME_DURATION_MINUTES = 120;
const ENGLISH_CODE = "ENG";

// ─── Input types (framework-agnostic, mirrors Zod schema outputs) ─────────────
export type MockExamInput = {
  mode: "MOCK";
  subjectIds: string[];
  proseTextId?: string;
};

export type PracticeExamInput = {
  mode: "PRACTICE";
  subjectId: string;
  questionCount: number;
};

export type TopicExamInput = {
  mode: "TOPIC";
  subjectId: string;
  topicId: string;
  questionCount: number;
};

export type ExamFactoryInput = MockExamInput | PracticeExamInput | TopicExamInput;

export type ExamFactoryResult = {
  questionIds: string[];
  durationMinutes: number;
};

// ─── Error type ───────────────────────────────────────────────────────────────
export class ExamFactoryError extends Error {
  constructor(
    message: string,
    public readonly statusHint: 400 | 422 | 500 = 422
  ) {
    super(message);
    this.name = "ExamFactoryError";
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────
export class ExamFactory {
  constructor(private readonly db: PrismaClient) {}

  async build(input: ExamFactoryInput): Promise<ExamFactoryResult> {
    switch (input.mode) {
      case "MOCK":
        return this.buildMock(input);
      case "PRACTICE":
        return this.buildPractice(input);
      case "TOPIC":
        return this.buildTopic(input);
    }
  }

  private async buildMock(input: MockExamInput): Promise<ExamFactoryResult> {
    const english = await this.db.subject.findFirst({
      where: { code: ENGLISH_CODE, isActive: true },
      select: { id: true },
    });

    if (!english) {
      throw new ExamFactoryError(
        "Use of English subject is not configured in the system",
        500
      );
    }

    if (input.subjectIds.includes(english.id)) {
      throw new ExamFactoryError(
        "Use of English is included automatically — please select 3 other subjects",
        400
      );
    }

    let proseId = input.proseTextId ?? null;
    if (!proseId) {
      const randomProse = await this.db.proseText.findFirst({
        where: { isPublished: true },
        select: { id: true },
      });
      proseId = randomProse?.id ?? null;
    }

    const [engRows, proseRows] = await Promise.all([
      this.db.$queryRaw<{ id: string }[]>`
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
        ? this.db.$queryRaw<{ id: string }[]>`
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
        this.db.$queryRaw<{ id: string }[]>`
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
        `
      )
    );

    const questionIds = [
      ...fisherYates(engRows.map((r) => r.id)),
      ...fisherYates(proseRows.map((r) => r.id)),
      ...subjectBatches.flatMap((batch) => fisherYates(batch.map((r) => r.id))),
    ];

    if (questionIds.length === 0) {
      throw new ExamFactoryError("No questions available for the selected subjects", 422);
    }

    return { questionIds, durationMinutes: UTME_DURATION_MINUTES };
  }

  private async buildPractice(input: PracticeExamInput): Promise<ExamFactoryResult> {
    const rows = await this.db.$queryRaw<{ id: string }[]>`
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
      throw new ExamFactoryError("No questions available for this selection", 422);
    }

    return {
      questionIds,
      durationMinutes: input.questionCount * 2,
    };
  }

  private async buildTopic(input: TopicExamInput): Promise<ExamFactoryResult> {
    const rows = await this.db.$queryRaw<{ id: string }[]>`
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
      throw new ExamFactoryError("No questions available for this selection", 422);
    }

    return {
      questionIds,
      durationMinutes: input.questionCount * 2,
    };
  }
}

function fisherYates<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
