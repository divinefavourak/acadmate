import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";
import { bulkSaveAnswersSchema } from "@/lib/validation/exams";
import { resolveExamExpiry } from "@/lib/services/exam-expiry";

// POST /api/exams/[id]/answers - Save/update answers (auto-save)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const userId = session!.user!.id!;

    const examSession = await prisma.examSession.findUnique({
      where: { id, userId, status: "IN_PROGRESS" },
      select: { id: true, expiresAt: true, status: true },
    });

    if (!examSession) {
      return NextResponse.json({ error: "Active exam session not found" }, { status: 404 });
    }

    const expiry = await resolveExamExpiry(
      prisma,
      id,
      examSession.status,
      examSession.expiresAt
    );

    if (expiry.expired) {
      return NextResponse.json({ error: "Exam session has expired" }, { status: 410 });
    }

    const body = await req.json();
    const parsed = bulkSaveAnswersSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { answers } = parsed.data;

    const questionIds = answers.map((a) => a.questionId);
    const options = await prisma.questionOption.findMany({
      where: { questionId: { in: questionIds }, isCorrect: true },
      select: { questionId: true, id: true },
    });
    const correctMap = new Map(options.map((o) => [o.questionId, o.id]));

    await prisma.$transaction(
      answers.map((answer) => {
        const correctOptionId = correctMap.get(answer.questionId);
        const isCorrect =
          answer.optionId !== null ? answer.optionId === correctOptionId : null;

        return prisma.userAnswer.upsert({
          where: {
            examSessionId_questionId: {
              examSessionId: id,
              questionId: answer.questionId,
            },
          },
          create: {
            examSessionId: id,
            questionId: answer.questionId,
            optionId: answer.optionId,
            isCorrect,
          },
          update: {
            optionId: answer.optionId,
            isCorrect,
          },
        });
      })
    );

    return NextResponse.json({ saved: answers.length });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
