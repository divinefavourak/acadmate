import type { PrismaClient } from "@prisma/client";
import { importRowSchema, type ImportRow } from "@/lib/validation/admin";

export type ImportRowError = { row: number; errors: string[] };

export type ProcessImportParams = {
  adminId: string;
  filename: string;
  rows: unknown[];
};

export type ProcessImportResult = {
  importId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  created: number;
  errors: ImportRowError[];
};

export class ImportService {
  constructor(private readonly db: PrismaClient) {}

  async processImport(params: ProcessImportParams): Promise<ProcessImportResult> {
    const { adminId, filename, rows } = params;

    const importRecord = await this.db.import.create({
      data: {
        uploadedById: adminId,
        filename,
        format: filename.endsWith(".csv") ? "CSV" : "JSON",
        status: "PROCESSING",
        totalRows: rows.length,
      },
    });

    // ── Validate all rows upfront ─────────────────────────────────────────────
    const validRows: ImportRow[] = [];
    const errorLog: ImportRowError[] = [];

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

    // ── Resolve subjects (single query) ──────────────────────────────────────
    const subjectNames = [...new Set(validRows.map((r) => r.subject))];
    const subjects = await this.db.subject.findMany({
      where: { name: { in: subjectNames } },
      select: { id: true, name: true },
    });
    const subjectMap = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]));

    // Separate rows that have resolvable subjects
    const resolvableRows: Array<ImportRow & { subjectId: string }> = [];
    const subjectErrors: ImportRowError[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const subjectId = subjectMap.get(row.subject.toLowerCase());
      if (!subjectId) {
        subjectErrors.push({ row: i + 1, errors: [`Subject not found: "${row.subject}"`] });
      } else {
        resolvableRows.push({ ...row, subjectId });
      }
    }

    // ── Resolve topics in one batch query ────────────────────────────────────
    // Collect all unique (subjectId, topicName) pairs that need resolving
    const topicLookups = resolvableRows
      .filter((r): r is typeof r & { topic: string } => Boolean(r.topic))
      .map((r) => ({ subjectId: r.subjectId, name: r.topic }));

    const topicMap = new Map<string, string>();

    if (topicLookups.length > 0) {
      const uniqueSubjectIds = [...new Set(topicLookups.map((t) => t.subjectId))];
      const allTopics = await this.db.topic.findMany({
        where: { subjectId: { in: uniqueSubjectIds } },
        select: { id: true, subjectId: true, name: true },
      });
      for (const topic of allTopics) {
        topicMap.set(`${topic.subjectId}:${topic.name.toLowerCase()}`, topic.id);
      }
    }

    // ── Build question create operations ─────────────────────────────────────
    const questionCreates = resolvableRows.map((row) => {
      const topicKey = row.topic
        ? `${row.subjectId}:${row.topic.toLowerCase()}`
        : null;
      const topicId = topicKey ? (topicMap.get(topicKey) ?? null) : null;

      const options = [
        { label: "A", text: row.optionA, isCorrect: row.correctOption === "A", sortOrder: 0 },
        { label: "B", text: row.optionB, isCorrect: row.correctOption === "B", sortOrder: 1 },
        { label: "C", text: row.optionC, isCorrect: row.correctOption === "C", sortOrder: 2 },
        { label: "D", text: row.optionD, isCorrect: row.correctOption === "D", sortOrder: 3 },
      ];

      return this.db.question.create({
        data: {
          subjectId: row.subjectId,
          topicId,
          text: row.text,
          year: row.year ?? null,
          difficulty: row.difficulty,
          sourceType: "IMPORTED",
          isPublished: false,
          importId: importRecord.id,
          options: { create: options },
          ...(row.explanation && {
            explanation: { create: { text: row.explanation, aiAssisted: false } },
          }),
        },
        select: { id: true },
      });
    });

    // ── Execute all creates in a single transaction ───────────────────────────
    const created = questionCreates.length > 0
      ? (await this.db.$transaction(questionCreates)).length
      : 0;

    const allErrors = [...errorLog, ...subjectErrors];

    await this.db.import.update({
      where: { id: importRecord.id },
      data: {
        status: "DONE",
        validRows: validRows.length,
        invalidRows: rows.length - validRows.length,
        publishedRows: 0,
        errorLog: allErrors.length > 0 ? allErrors : undefined,
      },
    });

    return {
      importId: importRecord.id,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.length - validRows.length,
      created,
      errors: allErrors,
    };
  }
}
