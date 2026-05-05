import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/analytics - Student performance dashboard data
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = session!.user!.id!;

    const results = await prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        score: true,
        correct: true,
        incorrect: true,
        unanswered: true,
        totalQuestions: true,
        createdAt: true,
        examSession: { select: { mode: true } },
        subjectBreakdowns: {
          select: { subjectId: true, name: true, correct: true, total: true },
        },
        topicBreakdowns: {
          select: { topicId: true, name: true, correct: true, total: true },
        },
      },
    });

    if (results.length === 0) {
      return NextResponse.json({
        totalTests: 0,
        averageScore: 0,
        bestScore: 0,
        recentTrend: [],
        subjectPerformance: [],
        weakTopics: [],
      });
    }

    const totalTests = results.length;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalTests;
    const bestScore = Math.max(...results.map((r) => r.score));

    const recentTrend = results.slice(-10).map((r) => ({
      id: r.id,
      score: r.score,
      mode: r.examSession.mode,
      date: r.createdAt,
    }));

    const subjectAgg: Record<string, { subjectId: string; name: string; correct: number; total: number }> = {};
    for (const result of results) {
      for (const s of result.subjectBreakdowns) {
        if (!subjectAgg[s.subjectId]) {
          subjectAgg[s.subjectId] = { subjectId: s.subjectId, name: s.name, correct: 0, total: 0 };
        }
        subjectAgg[s.subjectId].correct += s.correct;
        subjectAgg[s.subjectId].total += s.total;
      }
    }

    const subjectPerformance = Object.values(subjectAgg).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    }));

    const topicAgg: Record<string, { topicId: string; name: string; correct: number; total: number }> = {};
    for (const result of results) {
      for (const t of result.topicBreakdowns) {
        if (!topicAgg[t.topicId]) {
          topicAgg[t.topicId] = { topicId: t.topicId, name: t.name, correct: 0, total: 0 };
        }
        topicAgg[t.topicId].correct += t.correct;
        topicAgg[t.topicId].total += t.total;
      }
    }

    const weakTopics = Object.values(topicAgg)
      .filter((t) => t.total >= 3 && t.correct / t.total < 0.5)
      .map((t) => ({
        ...t,
        percentage: Math.round((t.correct / t.total) * 100),
      }))
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 10);

    return NextResponse.json({
      totalTests,
      averageScore: Math.round(averageScore * 100) / 100,
      bestScore: Math.round(bestScore * 100) / 100,
      recentTrend,
      subjectPerformance,
      weakTopics,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
