import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/exams/[id] - Get exam session with questions (no correct answers)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const userId = session!.user!.id!;

    const examSession = await prisma.examSession.findUnique({
      where: { id, userId },
      select: {
        id: true,
        mode: true,
        status: true,
        totalQuestions: true,
        durationMinutes: true,
        expiresAt: true,
        startedAt: true,
        submittedAt: true,
        currentQuestion: true,
        questions: {
          orderBy: { position: "asc" },
          select: {
            position: true,
            markedReview: true,
            question: {
              select: {
                id: true,
                text: true,
                subject: { select: { id: true, name: true, code: true } },
                topic: { select: { id: true, name: true } },
                options: {
                  select: { id: true, label: true, text: true, sortOrder: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
        userAnswers: {
          select: { questionId: true, optionId: true },
        },
      },
    });

    if (!examSession) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    // Auto-expire if past deadline
    if (
      examSession.status === "IN_PROGRESS" &&
      examSession.expiresAt &&
      new Date() > examSession.expiresAt
    ) {
      await prisma.examSession.update({
        where: { id },
        data: { status: "TIMED_OUT", submittedAt: new Date() },
      });
    }

    return NextResponse.json({ examSession });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
