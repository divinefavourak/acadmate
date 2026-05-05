import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";
import { createExamSessionSchema } from "@/lib/validation/exams";
import { ExamFactory, ExamFactoryError } from "@/lib/services/exam-factory";

const examFactory = new ExamFactory(prisma);

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
    const input = parsed.data;

    const { questionIds, durationMinutes } = await examFactory.build(input);

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const examSession = await prisma.examSession.create({
      data: {
        userId,
        mode: input.mode,
        subjectId: "subjectId" in input ? input.subjectId : undefined,
        topicId: "topicId" in input ? input.topicId : undefined,
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
  } catch (err) {
    if (err instanceof ExamFactoryError) {
      return NextResponse.json({ error: err.message }, { status: err.statusHint });
    }
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
