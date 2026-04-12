import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";

// PATCH /api/admin/questions/[id]/publish - Toggle publish status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const { isPublished } = await req.json();
    const adminId = session!.user!.id!;

    const question = await prisma.question.update({
      where: { id },
      data: {
        isPublished,
        ...(isPublished && {
          reviewedAt: new Date(),
          reviewedById: adminId,
        }),
      },
      select: { id: true, isPublished: true, reviewedAt: true },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        action: isPublished ? "PUBLISH_QUESTION" : "UNPUBLISH_QUESTION",
        entityType: "question",
        entityId: id,
      },
    });

    return NextResponse.json({ question });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
