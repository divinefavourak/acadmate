import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/my-flags — student's flagged questions with resolved status
export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = session!.user!.id!;

    const flags = await prisma.questionFlag.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        resolved: true,
        resolvedAt: true,
        createdAt: true,
        question: {
          select: {
            id: true,
            text: true,
            isFlagged: true,
            year: true,
            subject: { select: { name: true } },
            topic: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
