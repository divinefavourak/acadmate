import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

const markReviewBody = z.object({
  questionId: z.string().cuid(),
  markedReview: z.boolean(),
});

// PATCH /api/exams/[id]/review - Toggle mark-for-review on a question
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const userId = session!.user!.id!;

    const body = await req.json();
    const parsed = markReviewBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const { questionId, markedReview } = parsed.data;

    const examSession = await prisma.examSession.findUnique({
      where: { id, userId, status: "IN_PROGRESS" },
      select: { id: true },
    });

    if (!examSession) {
      return NextResponse.json({ error: "Active exam session not found" }, { status: 404 });
    }

    await prisma.examSessionQuestion.update({
      where: { examSessionId_questionId: { examSessionId: id, questionId } },
      data: { markedReview },
    });

    return NextResponse.json({ questionId, markedReview });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
