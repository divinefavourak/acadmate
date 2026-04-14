// app/api/admin/questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";
import { questionQuerySchema, createQuestionSchema } from "@/lib/validation/questions";

// Auto-flag a question if it has no correct option or too many options
async function autoValidateQuestion(questionId: string) {
  const [correctOption, optionCount] = await Promise.all([
    prisma.questionOption.findFirst({ where: { questionId, isCorrect: true }, select: { id: true } }),
    prisma.questionOption.count({ where: { questionId } }),
  ]);

  const issues: string[] = [];
  if (!correctOption) issues.push("no correct answer set");
  if (optionCount > 5) issues.push(`too many options (${optionCount})`);

  if (issues.length > 0) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { text: true, subject: { select: { name: true } } },
    });
    const preview = (question?.text ?? "").substring(0, 80);
    const type = !correctOption ? "NO_CORRECT_ANSWER" : "TOO_MANY_OPTIONS";
    const message = `[${question?.subject.name ?? "Unknown"}] ${issues.join(", ")}: "${preview}…"`;

    await prisma.$transaction([
      prisma.question.update({ where: { id: questionId }, data: { isFlagged: true } }),
      prisma.adminNotification.create({ data: { type, questionId, message } }),
    ]);
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = req.nextUrl;
    
    // Use '||' instead of '??' to turn empty strings ("") into undefined
    const parsed = questionQuerySchema.safeParse({
      subjectId: searchParams.get("subjectId") || undefined,
      topicId: searchParams.get("topicId") || undefined,
      difficulty: searchParams.get("difficulty") || undefined,
      year: searchParams.get("year") || undefined,
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
      flagged: searchParams.get("flagged") || undefined,
      isPublished: searchParams.get("isPublished") || undefined,
    });

    if (!parsed.success) {
      // Improved error logging so you can see exactly which field failed in the console
      console.error("Query Validation Error:", parsed.error.format());
      return NextResponse.json({ error: "Invalid query", details: parsed.error.format() }, { status: 400 });
    }

    const { subjectId, topicId, difficulty, year, limit, offset, flagged, isPublished } = parsed.data;
    const filterNullYear = searchParams.get("year") === "unknown";

    const where = {
      ...(subjectId && { subjectId }),
      ...(topicId && { topicId }),
      ...(difficulty && { difficulty }),
      ...(isPublished !== undefined && { isPublished }),
      ...(flagged && { isFlagged: true }), // This handles your flagged questions
      ...(filterNullYear ? { year: null } : year !== undefined ? { year } : {}),
    };

    const [questions, total] = await Promise.all([
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
          isFlagged: true,
          flagCount: true,
          aiAssisted: true,
          sourceType: true,
          subject: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
          _count: { select: { options: true } },
        },
        orderBy: { updatedAt: "desc" }, // Order by newest updates so flagged ones show first
      }),
      prisma.question.count({ where }),
    ]);

    return NextResponse.json({ questions, total, limit, offset });
  } catch (err) {
    console.error(err);
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

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        action: "CREATE_QUESTION",
        entityType: "question",
        entityId: question.id,
      },
    });

    // Auto-flag if no correct answer or too many options
    await autoValidateQuestion(question.id);

    return NextResponse.json({ question }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}