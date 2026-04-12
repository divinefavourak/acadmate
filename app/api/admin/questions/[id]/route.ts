import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";
import { updateQuestionSchema } from "@/lib/validation/questions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        explanation: true,
        subject: true,
        topic: true,
        proseText: { select: { id: true, title: true } },
      },
    });
    if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ question });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { options, explanation, aiAssistedExplanation, ...questionData } = parsed.data;
    const adminId = session!.user!.id!;

    const question = await prisma.question.update({
      where: { id },
      data: {
        ...questionData,
        ...(options && {
          options: {
            deleteMany: {},
            create: options.map((opt, idx) => ({
              label: opt.label,
              text: opt.text,
              isCorrect: opt.isCorrect,
              sortOrder: opt.sortOrder ?? idx,
            })),
          },
        }),
        ...(explanation !== undefined && {
          explanation: {
            upsert: {
              create: { text: explanation, aiAssisted: aiAssistedExplanation ?? false },
              update: { text: explanation },
            },
          },
        }),
      },
      include: { options: true, explanation: true },
    });

    await prisma.adminActivityLog.create({
      data: { adminId, action: "UPDATE_QUESTION", entityType: "question", entityId: id },
    });

    return NextResponse.json({ question });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const adminId = session!.user!.id!;
    await prisma.question.delete({ where: { id } });
    await prisma.adminActivityLog.create({
      data: { adminId, action: "DELETE_QUESTION", entityType: "question", entityId: id },
    });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
