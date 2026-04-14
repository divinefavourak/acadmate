import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";
import { computeScore } from "@/lib/utils/scoring";

// POST /api/exams/[id]/submit - Submit exam and generate result
export async function POST(
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
      select: { id: true, status: true, totalQuestions: true, expiresAt: true },
    });

    if (!examSession) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    if (examSession.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Exam has already been submitted" },
        { status: 409 }
      );
    }

    const isTimedOut =
      examSession.expiresAt && new Date() > examSession.expiresAt;

    // Fetch answers + questions flagged by this user (flagged questions don't count)
    const [answers, userFlags] = await Promise.all([
      prisma.userAnswer.findMany({
        where: { examSessionId: id },
        select: {
          questionId: true,
          isCorrect: true,
          question: {
            select: {
              subjectId: true,
              topicId: true,
              subject: { select: { id: true, name: true } },
              topic: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.questionFlag.findMany({
        where: {
          userId,
          question: {
            examSessionQuestions: { some: { examSessionId: id } },
          },
        },
        select: { questionId: true },
      }),
    ]);

    const flaggedIds = new Set(userFlags.map((f) => f.questionId));
    const scorableAnswers = answers.filter((a) => !flaggedIds.has(a.questionId));
    const effectiveTotal = examSession.totalQuestions - flaggedIds.size;

    const { correct, incorrect, unanswered, score, subjectBreakdown, topicBreakdown } =
      computeScore(scorableAnswers, Math.max(effectiveTotal, 0));

    const [, result] = await prisma.$transaction([
      prisma.examSession.update({
        where: { id },
        data: {
          status: isTimedOut ? "TIMED_OUT" : "SUBMITTED",
          submittedAt: new Date(),
        },
      }),
      prisma.result.create({
        data: {
          examSessionId: id,
          userId,
          totalQuestions: examSession.totalQuestions,
          correct,
          incorrect,
          unanswered,
          score,
          subjectBreakdown,
          topicBreakdown,
        },
      }),
    ]);

    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
