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

    const isTimedOut = examSession.expiresAt && new Date() > examSession.expiresAt;

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
    const effectiveTotal = Math.max(examSession.totalQuestions - flaggedIds.size, 0);

    const { correct, incorrect, unanswered, score, subjectBreakdown, topicBreakdown } =
      computeScore(scorableAnswers, effectiveTotal);

    // Interactive transaction: we need the generated resultId to write child rows,
    // so this cannot use the sequential $transaction([...]) form.
    const result = await prisma.$transaction(async (tx) => {
      await tx.examSession.update({
        where: { id },
        data: {
          status: isTimedOut ? "TIMED_OUT" : "SUBMITTED",
          submittedAt: new Date(),
        },
      });

      const newResult = await tx.result.create({
        data: {
          examSessionId: id,
          userId,
          totalQuestions: examSession.totalQuestions,
          correct,
          incorrect,
          unanswered,
          score,
        },
      });

      // Dual-write: normalized breakdown tables (Phase 2 migration step)
      await Promise.all([
        subjectBreakdown.length > 0 &&
          tx.resultSubjectBreakdown.createMany({
            data: subjectBreakdown.map((s) => ({
              resultId: newResult.id,
              subjectId: s.subjectId,
              name: s.name,
              correct: s.correct,
              total: s.total,
            })),
          }),
        topicBreakdown.length > 0 &&
          tx.resultTopicBreakdown.createMany({
            data: topicBreakdown.map((t) => ({
              resultId: newResult.id,
              topicId: t.topicId,
              name: t.name,
              correct: t.correct,
              total: t.total,
            })),
          }),
      ]);

      return newResult;
    });

    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
