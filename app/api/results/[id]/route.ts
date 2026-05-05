import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/results/[id] - Full result detail with per-question breakdown
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const userId = session!.user!.id!;

    const result = await prisma.result.findUnique({
      where: { id, userId },
      select: {
        id: true,
        score: true,
        correct: true,
        incorrect: true,
        unanswered: true,
        totalQuestions: true,
        createdAt: true,
        examSession: {
          select: {
            id: true,
            mode: true,
            status: true,
            durationMinutes: true,
            startedAt: true,
            submittedAt: true,
            userAnswers: {
              select: {
                questionId: true,
                optionId: true,
                isCorrect: true,
                question: {
                  select: {
                    id: true,
                    text: true,
                    subject: { select: { id: true, name: true } },
                    topic: { select: { id: true, name: true } },
                    options: {
                      select: { id: true, label: true, text: true, isCorrect: true, sortOrder: true },
                      orderBy: { sortOrder: "asc" },
                    },
                    explanation: { select: { text: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
