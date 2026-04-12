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
    ] = await prisma.$transaction([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.question.count(),
      prisma.question.count({ where: { isPublished: true } }),
      prisma.examSession.count(),
      prisma.import.count(),
      prisma.examSession.findMany({
        take: 7,
        orderBy: { createdAt: "desc" },
        where: { status: { in: ["SUBMITTED", "TIMED_OUT"] } },
        select: { createdAt: true },
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

    return NextResponse.json({
      totalStudents,
      totalQuestions,
      publishedQuestions,
      totalExams,
      totalImports,
      dailyExamActivity: dailyCounts,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
