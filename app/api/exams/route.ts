import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";
import { createExamSessionSchema } from "@/lib/validation/exams";

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

    const { mode, examTemplateId, subjectId, topicId, proseTextId, questionCount } = parsed.data;
    const userId = session!.user!.id!;

    // Fetch questions based on mode
    let questionIds: string[] = [];

    if (mode === "MOCK" && examTemplateId) {
      // Pull from exam template subject distribution
      const template = await prisma.examTemplate.findUnique({
        where: { id: examTemplateId, isActive: true },
        include: { subjects: true },
      });

      if (!template) {
        return NextResponse.json({ error: "Exam template not found" }, { status: 404 });
      }

      // Fetch all subjects in parallel, let Postgres do the random sampling
      const perSubject = await Promise.all(
        template.subjects.map((ts) =>
          prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM questions
            WHERE "subjectId" = ${ts.subjectId} AND "isPublished" = true
            ORDER BY RANDOM()
            LIMIT ${ts.questionCount}
          `
        )
      );
      questionIds = perSubject.flat().map((r) => r.id);

      // Duration comes from the template we already have
      const durationMinutes = template.durationMinutes ?? 120;
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
      questionIds = fisherYates(questionIds);

      const examSession = await prisma.examSession.create({
        data: {
          userId,
          examTemplateId,
          mode,
          totalQuestions: questionIds.length,
          durationMinutes,
          expiresAt,
          questions: { create: questionIds.map((qid, idx) => ({ questionId: qid, position: idx })) },
        },
        select: { id: true, mode: true, totalQuestions: true, durationMinutes: true, expiresAt: true, startedAt: true },
      });
      return NextResponse.json({ examSession }, { status: 201 });

    } else if (proseTextId) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM questions
        WHERE "proseTextId" = ${proseTextId} AND "isPublished" = true
        ORDER BY RANDOM()
        LIMIT ${questionCount}
      `;
      questionIds = rows.map((r) => r.id);
    } else if (mode === "TOPIC" && topicId) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM questions
        WHERE "topicId" = ${topicId} AND "isPublished" = true
        ORDER BY RANDOM()
        LIMIT ${questionCount}
      `;
      questionIds = rows.map((r) => r.id);
    } else if (subjectId) {
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

    // Determine duration
    let durationMinutes = 120;
    if (mode === "PRACTICE" || mode === "TOPIC") {
      durationMinutes = questionCount * 2;
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const examSession = await prisma.examSession.create({
      data: {
        userId,
        examTemplateId: examTemplateId ?? null,
        mode,
        subjectId: subjectId ?? null,
        topicId: topicId ?? null,
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
