import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/topics?subjectId= — list topics for a subject with question counts
export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const subjectId = req.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
  }

  try {
    const topics = await prisma.topic.findMany({
      where: { subjectId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            questions: { where: { isPublished: true } },
          },
        },
      },
    });

    return NextResponse.json({ topics });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
