import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/prose/[id]/questions - Questions linked to a prose text
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "40"), 100);
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");

    const [questions, total] = await prisma.$transaction([
      prisma.question.findMany({
        where: { proseTextId: id, isPublished: true },
        take: limit,
        skip: offset,
        select: {
          id: true,
          text: true,
          difficulty: true,
          year: true,
          options: {
            select: { id: true, label: true, text: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.question.count({ where: { proseTextId: id, isPublished: true } }),
    ]);

    return NextResponse.json({ questions, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
