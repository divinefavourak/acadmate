import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";
import { createQuestionSchema, questionQuerySchema } from "@/lib/validation/questions";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = req.nextUrl;
    const parsed = questionQuerySchema.safeParse({
      subjectId: searchParams.get("subjectId") ?? undefined,
      topicId: searchParams.get("topicId") ?? undefined,
      difficulty: searchParams.get("difficulty") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const { subjectId, topicId, difficulty, limit, offset } = parsed.data;
    const isPublished = searchParams.get("isPublished");

    const where = {
      ...(subjectId && { subjectId }),
      ...(topicId && { topicId }),
      ...(difficulty && { difficulty }),
      ...(isPublished !== null && { isPublished: isPublished === "true" }),
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
          isPublished: true,
          aiAssisted: true,
          sourceType: true,
          sourceRef: true,
          reviewedAt: true,
          subject: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
          explanation: { select: { id: true, aiAssisted: true, reviewed: true } },
          _count: { select: { options: true } },
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

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { options, explanation, aiAssistedExplanation, ...questionData } = parsed.data;
    const adminId = session!.user!.id!;

    const question = await prisma.question.create({
      data: {
        ...questionData,
        options: {
          create: options.map((opt, idx) => ({
            label: opt.label,
            text: opt.text,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder ?? idx,
          })),
        },
        ...(explanation && {
          explanation: {
            create: {
              text: explanation,
              aiAssisted: aiAssistedExplanation ?? false,
            },
          },
        }),
      },
      include: { options: true, explanation: true },
    });

    // Log admin activity
    await prisma.adminActivityLog.create({
      data: {
        adminId,
        action: "CREATE_QUESTION",
        entityType: "question",
        entityId: question.id,
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
