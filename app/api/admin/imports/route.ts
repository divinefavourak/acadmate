import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";
import { importRowSchema } from "@/lib/validation/admin";

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

    // Create import record
    const importRecord = await prisma.import.create({
      data: {
        uploadedById: adminId,
        filename,
        format: filename.endsWith(".csv") ? "CSV" : "JSON",
        status: "PROCESSING",
        totalRows: rows.length,
      },
    });

    // Validate rows
    const validRows: typeof importRowSchema._type[] = [];
    const errorLog: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = importRowSchema.safeParse(rows[i]);
      if (parsed.success) {
        validRows.push(parsed.data);
      } else {
        errorLog.push({
          row: i + 1,
          errors: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
      }
    }

    // Resolve subjects and topics
    const subjectNames = [...new Set(validRows.map((r) => r.subject))];
    const subjects = await prisma.subject.findMany({
      where: { name: { in: subjectNames } },
      select: { id: true, name: true },
    });
    const subjectMap = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]));

    // Create questions as drafts (not published)
    let created = 0;
    const creationErrors: typeof errorLog = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const subjectId = subjectMap.get(row.subject.toLowerCase());

      if (!subjectId) {
        creationErrors.push({ row: i + 1, errors: [`Subject not found: ${row.subject}`] });
        continue;
      }

      // Resolve topic if provided
      let topicId: string | null = null;
      if (row.topic) {
        const topic = await prisma.topic.findFirst({
          where: { subjectId, name: { equals: row.topic, mode: "insensitive" } },
          select: { id: true },
        });
        topicId = topic?.id ?? null;
      }

      const correctLabel = row.correctOption;
      const options = [
        { label: "A", text: row.optionA, isCorrect: correctLabel === "A", sortOrder: 0 },
        { label: "B", text: row.optionB, isCorrect: correctLabel === "B", sortOrder: 1 },
        { label: "C", text: row.optionC, isCorrect: correctLabel === "C", sortOrder: 2 },
        { label: "D", text: row.optionD, isCorrect: correctLabel === "D", sortOrder: 3 },
      ];

      await prisma.question.create({
        data: {
          subjectId,
          topicId,
          text: row.text,
          year: row.year ?? null,
          difficulty: row.difficulty,
          sourceType: "IMPORTED",
          isPublished: false,
          importId: importRecord.id,
          options: { create: options },
          ...(row.explanation && {
            explanation: {
              create: { text: row.explanation, aiAssisted: false },
            },
          }),
        },
      });
      created++;
    }

    const allErrors = [...errorLog, ...creationErrors];

    await prisma.import.update({
      where: { id: importRecord.id },
      data: {
        status: "DONE",
        validRows: validRows.length,
        invalidRows: rows.length - validRows.length,
        publishedRows: 0,
        errorLog: allErrors.length > 0 ? allErrors : undefined,
      },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        action: "IMPORT_QUESTIONS",
        entityType: "import",
        entityId: importRecord.id,
        details: { filename, totalRows: rows.length, created, errors: allErrors.length },
      },
    });

    return NextResponse.json({
      importId: importRecord.id,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.length - validRows.length,
      created,
      errors: allErrors,
    });
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
