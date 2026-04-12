import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/prose - List all published prose texts
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const texts = await prisma.proseText.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        author: true,
        year: true,
        summary: true,
        _count: {
          select: {
            questions: { where: { isPublished: true } },
            sections: true,
          },
        },
      },
      orderBy: { title: "asc" },
    });

    return NextResponse.json({ texts });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
