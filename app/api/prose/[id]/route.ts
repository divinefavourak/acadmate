import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/prose/[id] - Full prose text with sections
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;

    const text = await prisma.proseText.findUnique({
      where: { id, isPublished: true },
      select: {
        id: true,
        title: true,
        author: true,
        year: true,
        summary: true,
        themes: true,
        sections: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true, content: true, sortOrder: true },
        },
      },
    });

    if (!text) {
      return NextResponse.json({ error: "Prose text not found" }, { status: 404 });
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
