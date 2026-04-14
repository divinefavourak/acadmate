import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// POST /api/questions/[id]/flag — student reports a question issue
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const userId = session!.user!.id!;

    // Prevent double-flagging
    const existing = await prisma.questionFlag.findUnique({
      where: { questionId_userId: { questionId: id, userId } },
    });
    if (existing) {
      return NextResponse.json({ flagged: true, alreadyFlagged: true });
    }

    // Fetch question details for the notification message
    const question = await prisma.question.findUnique({
      where: { id },
      select: {
        text: true,
        year: true,
        subject: { select: { name: true } },
        topic: { select: { name: true } },
      },
    });
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const preview = question.text.length > 80
      ? question.text.substring(0, 80) + "…"
      : question.text;
    const subjectLabel = question.subject.name + (question.year ? ` (${question.year})` : "");
    const message = `[${subjectLabel}] ${preview}`;

    await prisma.$transaction([
      prisma.questionFlag.create({ data: { questionId: id, userId } }),
      prisma.question.update({
        where: { id },
        data: { isFlagged: true, flagCount: { increment: 1 } },
      }),
      prisma.adminNotification.create({
        data: {
          type: "QUESTION_FLAGGED",
          questionId: id,
          triggeredById: userId,
          message,
        },
      }),
    ]);

    return NextResponse.json({ flagged: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
