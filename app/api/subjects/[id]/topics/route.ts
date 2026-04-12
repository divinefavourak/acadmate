import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const topics = await prisma.topic.findMany({
      where: { subjectId: id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { questions: { where: { isPublished: true } } } },
      },
    });

    return NextResponse.json({ topics });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
