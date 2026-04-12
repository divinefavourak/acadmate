import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/results - User's result history
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = session!.user!.id!;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");

    const [results, total] = await prisma.$transaction([
      prisma.result.findMany({
        where: { userId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          score: true,
          correct: true,
          incorrect: true,
          unanswered: true,
          totalQuestions: true,
          subjectBreakdown: true,
          createdAt: true,
          examSession: {
            select: {
              id: true,
              mode: true,
              status: true,
              durationMinutes: true,
              startedAt: true,
              submittedAt: true,
            },
          },
        },
      }),
      prisma.result.count({ where: { userId } }),
    ]);

    return NextResponse.json({ results, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
