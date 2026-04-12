import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        _count: { select: { questions: { where: { isPublished: true } } } },
      },
    });

    return NextResponse.json({ subjects });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
