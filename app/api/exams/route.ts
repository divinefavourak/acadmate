import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";
import { createExamSessionSchema } from "@/lib/validation/exams";

// ─── UTME mock question distribution ─────────────────────────────────────────
const UTME_ENGLISH_QUESTIONS = 30;   // regular Use of English (non-prose)
const UTME_PROSE_QUESTIONS = 10;     // comprehension questions tied to a prose text
const UTME_SUBJECT_QUESTIONS = 40;   // questions per chosen subject
const UTME_DURATION_MINUTES = 120;
const ENGLISH_CODE = "ENG";

function fisherYates<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// POST /api/exams - Create a new exam session
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createExamSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const userId = session!.user!.id!;
    const { mode } = parsed.data;

    // ── Full UTME Mock ──────────────────────────────────────────────────────
    if (mode === "MOCK") {
      const { subjectIds, proseTextId: requestedProseId } = parsed.data;

      // Locate Use of English subject
      const english = await prisma.subject.findFirst({
        where: { code: ENGLISH_CODE, isActive: true },
        select: { id: true },
      });
      if (!english) {
        return NextResponse.json(
          { error: "Use of English subject is not configured in the system" },
          { status: 500 }
        );
      }

      // Guard: user must not have included English in their 3 picks
      if (subjectIds.includes(english.id)) {
        return NextResponse.json(
          { error: "Use of English is included automatically — please select 3 other subjects" },
          { status: 400 }
        );
      }

      // Resolve prose text (user-chosen or random)
      let proseId: string | null = requestedProseId ?? null;
      if (!proseId) {
        const randomProse = await prisma.proseText.findFirst({
          where: { isPublished: true },
          select: { id: true },
        });
        proseId = randomProse?.id ?? null;
      }

      // Fetch all question batches in parallel
      const [engRows, proseRows] = await Promise.all([
        prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM questions
          WHERE "subjectId" = ${english.id}
            AND "isPublished" = true
            AND "proseTextId" IS NULL
          ORDER BY RANDOM()
          LIMIT ${UTME_ENGLISH_QUESTIONS}
        `,
        proseId
          ? prisma.$queryRaw<{ id: string }[]>`
              SELECT id FROM questions
              WHERE "proseTextId" = ${proseId}
                AND "isPublished" = true
              ORDER BY RANDOM()
              LIMIT ${UTME_PROSE_QUESTIONS}
            `
          : Promise.resolve<{ id: string }[]>([]),
      ]);

      const subjectRowBatches = await Promise.all(
        subjectIds.map((sid) =>
          prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM questions
            WHERE "subjectId" = ${sid}
              AND "isPublished" = true
            ORDER BY RANDOM()
            LIMIT ${UTME_SUBJECT_QUESTIONS}
          `
        )
      );

      // Keep questions grouped by subject; only shuffle within each group
      const allIds = [
        ...fisherYates(engRows.map((r) => r.id)),
        ...fisherYates(proseRows.map((r) => r.id)),
        ...subjectRowBatches.map((batch) => fisherYates(batch.map((r) => r.id))).flat(),
      ];

      if (allIds.length === 0) {
        return NextResponse.json(
          { error: "No questions available for the selected subjects" },
          { status: 422 }
        );
      }

      const expiresAt = new Date(Date.now() + UTME_DURATION_MINUTES * 60 * 1000);

      const examSession = await prisma.examSession.create({
        data: {
          userId,
          mode: "MOCK",
          totalQuestions: allIds.length,
          durationMinutes: UTME_DURATION_MINUTES,
          expiresAt,
          questions: {
            create: allIds.map((qid, idx) => ({ questionId: qid, position: idx })),
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

      return NextResponse.json({ examSession }, { status: 201 });
    }

    // ── Practice / Topic ────────────────────────────────────────────────────
    const { subjectId, questionCount } = parsed.data;
    const topicId = mode === "TOPIC" ? parsed.data.topicId : undefined;

    let questionIds: string[] = [];

    if (mode === "TOPIC" && topicId) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM questions
        WHERE "topicId" = ${topicId} AND "isPublished" = true
        ORDER BY RANDOM()
        LIMIT ${questionCount}
      `;
      questionIds = rows.map((r) => r.id);
    } else {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM questions
        WHERE "subjectId" = ${subjectId} AND "isPublished" = true
        ORDER BY RANDOM()
        LIMIT ${questionCount}
      `;
      questionIds = rows.map((r) => r.id);
    }

    if (questionIds.length === 0) {
      return NextResponse.json(
        { error: "No questions available for this selection" },
        { status: 422 }
      );
    }

    questionIds = fisherYates(questionIds);
    const durationMinutes = questionCount * 2;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const examSession = await prisma.examSession.create({
      data: {
        userId,
        mode,
        subjectId,
        topicId: topicId ?? null,
        totalQuestions: questionIds.length,
        durationMinutes,
        expiresAt,
        questions: {
          create: questionIds.map((qid, idx) => ({ questionId: qid, position: idx })),
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

    return NextResponse.json({ examSession }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/exams - List user's exam sessions
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = session!.user!.id!;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");

    const [sessions, total] = await Promise.all([
      prisma.examSession.findMany({
        where: { userId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
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
      prisma.examSession.count({ where: { userId } }),
    ]);

    return NextResponse.json({ sessions, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
