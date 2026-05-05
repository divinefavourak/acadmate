import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";
import { resolveExamExpiry } from "@/lib/services/exam-expiry";

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
                imageUrl: true,
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

    // Expiry check: the write is delegated to the service.
    // The cron job (`expireStaleSessions`) handles bulk expiry; this call
    // handles the case where a student re-opens a session slightly after deadline.
    await resolveExamExpiry(prisma, id, examSession.status, examSession.expiresAt);

    return NextResponse.json({ examSession });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
