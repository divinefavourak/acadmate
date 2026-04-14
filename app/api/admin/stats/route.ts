import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";

// GET /api/admin/stats - Platform-wide stats for admin dashboard
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [
      totalStudents,
      totalQuestions,
      publishedQuestions,
      totalExams,
      totalImports,
      recentExams,
      questionsPerSubject,
      results,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.question.count(),
      prisma.question.count({ where: { isPublished: true } }),
      prisma.examSession.count(),
      prisma.import.count(),
      prisma.examSession.findMany({
        take: 200,
        orderBy: { createdAt: "desc" },
        where: { status: { in: ["SUBMITTED", "TIMED_OUT"] } },
        select: { createdAt: true },
      }),
      prisma.subject.findMany({
        where: { isActive: true },
        select: {
          code: true,
          _count: { select: { questions: { where: { isPublished: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.result.findMany({
        select: { score: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Group recent exams by day (last 7 days)
    const today = new Date();
    const dailyCounts = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      const label = day.toLocaleDateString("en-NG", { weekday: "short" });
      const count = recentExams.filter((e) => {
        const d = new Date(e.createdAt);
        return (
          d.getDate() === day.getDate() &&
          d.getMonth() === day.getMonth() &&
          d.getFullYear() === day.getFullYear()
        );
      }).length;
      return { label, count };
    });

    // Questions per subject (published only)
    const questionsBySubject = questionsPerSubject.map((s) => ({
      subject: s.code,
      questions: s._count.questions,
    }));

    // Score distribution across 5 bands
    const bands = [
      { label: "0–20%", min: 0, max: 20 },
      { label: "21–40%", min: 21, max: 40 },
      { label: "41–60%", min: 41, max: 60 },
      { label: "61–80%", min: 61, max: 80 },
      { label: "81–100%", min: 81, max: 100 },
    ];
    const scoreDistribution = bands.map(({ label, min, max }) => ({
      label,
      count: results.filter((r) => r.score >= min && r.score <= max).length,
    }));

    return NextResponse.json({
      totalStudents,
      totalQuestions,
      publishedQuestions,
      totalExams,
      totalImports,
      dailyExamActivity: dailyCounts,
      questionsBySubject,
      scoreDistribution,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
