import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/helpers";
import { questionQuerySchema } from "@/lib/validation/questions";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = req.nextUrl;
    const parsed = questionQuerySchema.safeParse({
      subjectId: searchParams.get("subjectId"),
      topicId: searchParams.get("topicId"),
      difficulty: searchParams.get("difficulty"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { subjectId, topicId, difficulty, limit, offset } = parsed.data;

    const where = {
      isPublished: true,
      ...(subjectId && { subjectId }),
      ...(topicId && { topicId }),
      ...(difficulty && { difficulty }),
    };

    const [questions, total] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        take: limit,
        skip: offset,
        select: {
          id: true,
          text: true,
          difficulty: true,
          year: true,
          subject: { select: { id: true, name: true, code: true } },
          topic: { select: { id: true, name: true } },
          options: {
            select: { id: true, label: true, text: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.question.count({ where }),
    ]);

    return NextResponse.json({ questions, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
