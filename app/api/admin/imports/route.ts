import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";
import { ImportService } from "@/lib/services/import.service";

const importService = new ImportService(prisma);

// POST /api/admin/imports - Upload and validate a question import
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { filename, rows } = body as { filename: string; rows: unknown[] };

    if (!filename || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "filename and rows[] are required" }, { status: 400 });
    }

    const adminId = session!.user!.id!;

    const result = await importService.processImport({ adminId, filename, rows });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        action: "IMPORT_QUESTIONS",
        entityType: "import",
        entityId: result.importId,
        details: {
          filename,
          totalRows: result.totalRows,
          created: result.created,
          errors: result.errors.length,
        },
      },
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/admin/imports - List import jobs
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");

    const [imports, total] = await prisma.$transaction([
      prisma.import.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          format: true,
          status: true,
          totalRows: true,
          validRows: true,
          invalidRows: true,
          publishedRows: true,
          createdAt: true,
          uploadedBy: { select: { name: true, email: true } },
        },
      }),
      prisma.import.count(),
    ]);

    return NextResponse.json({ imports, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
