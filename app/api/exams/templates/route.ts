import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";

// GET /api/exams/templates - List active exam templates
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const templates = await prisma.examTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        totalQuestions: true,
        subjects: {
          select: {
            questionCount: true,
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
