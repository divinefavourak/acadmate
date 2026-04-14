import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// POST /api/questions/[id]/flag — student flags a question as having an issue
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.question.update({
      where: { id },
      data: { isFlagged: true, flagCount: { increment: 1 } },
    });
    return NextResponse.json({ flagged: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
