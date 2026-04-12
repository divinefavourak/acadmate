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

      for (const ts of template.subjects) {
        // Fetch ALL published IDs for this subject, then sample randomly
        const allIds = await prisma.question.findMany({
          where: { subjectId: ts.subjectId, isPublished: true },
          select: { id: true },
        });
        const shuffled = fisherYates(allIds.map((q) => q.id));
        questionIds.push(...shuffled.slice(0, ts.questionCount));
      }
    } else if (proseTextId) {
      const allIds = await prisma.question.findMany({
        where: { proseTextId, isPublished: true },
        select: { id: true },
      });
      questionIds = fisherYates(allIds.map((q) => q.id)).slice(0, questionCount);
    } else if (mode === "TOPIC" && topicId) {
      const allIds = await prisma.question.findMany({
        where: { topicId, isPublished: true },
        select: { id: true },
      });
      questionIds = fisherYates(allIds.map((q) => q.id)).slice(0, questionCount);
    } else if (subjectId) {
      const allIds = await prisma.question.findMany({
        where: { subjectId, isPublished: true },
        select: { id: true },
      });
      questionIds = fisherYates(allIds.map((q) => q.id)).slice(0, questionCount);
    }

    if (questionIds.length === 0) {
      return NextResponse.json(
        { error: "No questions available for this selection" },
        { status: 422 }
      );
    }

    // Final shuffle of the assembled list
    questionIds = fisherYates(questionIds);

    // Determine duration
    let durationMinutes = 120;
    if (examTemplateId) {
      const tmpl = await prisma.examTemplate.findUnique({
        where: { id: examTemplateId },
        select: { durationMinutes: true },
      });
      durationMinutes = tmpl?.durationMinutes ?? 120;
    } else if (mode === "PRACTICE" || mode === "TOPIC") {
      durationMinutes = questionCount * 2; // 2 min per question for practice
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

    const [sessions, total] = await prisma.$transaction([
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
