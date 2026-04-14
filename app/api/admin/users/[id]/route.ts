import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";

// GET /api/admin/users/[id] — full student detail for admin
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const [user, results, recentSessions] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          studentProfile: {
            select: { targetScore: true, targetCourse: true, targetSchool: true },
          },
          _count: { select: { examSessions: true } },
        },
      }),
      prisma.result.findMany({
        where: { userId: id },
        select: { score: true, correct: true, totalQuestions: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.examSession.findMany({
        where: { userId: id, status: { in: ["SUBMITTED", "TIMED_OUT"] } },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          mode: true,
          status: true,
          totalQuestions: true,
          startedAt: true,
          submittedAt: true,
          result: { select: { score: true, correct: true } },
        },
      }),
    ]);

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totalExams = results.length;
    const averageScore = totalExams > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / totalExams * 10) / 10
      : 0;
    const bestScore = totalExams > 0 ? Math.max(...results.map((r) => r.score)) : 0;

    return NextResponse.json({ user, recentSessions, totalExams, averageScore, bestScore });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
