import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";

// POST /api/admin/imports/[id]/publish - Publish all valid questions from an import
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const adminId = session!.user!.id!;

    const importRecord = await prisma.import.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!importRecord) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }

    if (importRecord.status !== "DONE") {
      return NextResponse.json(
        { error: "Import must be in DONE status before publishing" },
        { status: 409 }
      );
    }

    const result = await prisma.question.updateMany({
      where: { importId: id, isPublished: false },
      data: {
        isPublished: true,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });

    await prisma.import.update({
      where: { id },
      data: { publishedRows: result.count },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        action: "PUBLISH_IMPORT",
        entityType: "import",
        entityId: id,
        details: { publishedCount: result.count },
      },
    });

    return NextResponse.json({ published: result.count });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
