import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;

    const question = await prisma.question.findUnique({
      where: { id, isPublished: true },
      select: {
        id: true,
        text: true,
        difficulty: true,
        year: true,
        subject: { select: { id: true, name: true, code: true } },
        topic: { select: { id: true, name: true } },
        proseText: { select: { id: true, title: true } },
        options: {
          select: { id: true, label: true, text: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        },
        explanation: { select: { id: true, text: true } },
      },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
