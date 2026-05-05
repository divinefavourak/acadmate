import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Types (identical to lib/validation/admin.ts importRowSchema shape) ──────
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

type ImportRow = {
  subject: string;
  topic?: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  year?: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
};

function validateImportRow(raw: unknown, rowNum: number): { data: ImportRow; errors: null } | { data: null; errors: ImportRowError } {
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (!r.subject || typeof r.subject !== 'string') errors.push('subject: Required string');
  if (!r.text || typeof r.text !== 'string') errors.push('text: Required string');
  if (!r.optionA || typeof r.optionA !== 'string') errors.push('optionA: Required string');
  if (!r.optionB || typeof r.optionB !== 'string') errors.push('optionB: Required string');
  if (!r.optionC || typeof r.optionC !== 'string') errors.push('optionC: Required string');
  if (!r.optionD || typeof r.optionD !== 'string') errors.push('optionD: Required string');
  if (!['A', 'B', 'C', 'D'].includes(r.correctOption as string)) {
    errors.push('correctOption: Must be A, B, C, or D');
  }

  const difficulty = (r.difficulty as string) ?? 'MEDIUM';
  if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
    errors.push('difficulty: Must be EASY, MEDIUM, or HARD');
  }

  if (errors.length > 0) return { data: null, errors: { row: rowNum, errors } };

  return {
    data: {
      subject: r.subject as string,
      topic: r.topic as string | undefined,
      text: r.text as string,
      optionA: r.optionA as string,
      optionB: r.optionB as string,
      optionC: r.optionC as string,
      optionD: r.optionD as string,
      correctOption: r.correctOption as 'A' | 'B' | 'C' | 'D',
      explanation: r.explanation as string | undefined,
      year: r.year ? Number(r.year) : undefined,
      difficulty: (difficulty as 'EASY' | 'MEDIUM' | 'HARD'),
    },
    errors: null,
  };
}

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async processImport(params: ProcessImportParams): Promise<ProcessImportResult> {
    const { adminId, filename, rows } = params;

    const importRecord = await this.prisma.import.create({
      data: {
        uploadedById: adminId,
        filename,
        format: filename.endsWith('.csv') ? 'CSV' : 'JSON',
        status: 'PROCESSING',
        totalRows: rows.length,
      },
    });

    // ── Validate all rows upfront ─────────────────────────────────────────
    const validRows: ImportRow[] = [];
    const errorLog: ImportRowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = validateImportRow(rows[i], i + 1);
      if (result.errors) {
        errorLog.push(result.errors);
      } else {
        validRows.push(result.data!);
      }
    }

    // ── Resolve subjects (single query) ────────────────────────────────────
    const subjectNames = [...new Set(validRows.map((r) => r.subject))];
    const subjects = await this.prisma.subject.findMany({
      where: { name: { in: subjectNames } },
      select: { id: true, name: true },
    });
    const subjectMap = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]));

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

    // ── Resolve topics in one batch query ─────────────────────────────────
    const topicLookups = resolvableRows
      .filter((r): r is typeof r & { topic: string } => Boolean(r.topic))
      .map((r) => ({ subjectId: r.subjectId, name: r.topic }));

    const topicMap = new Map<string, string>();

    if (topicLookups.length > 0) {
      const uniqueSubjectIds = [...new Set(topicLookups.map((t) => t.subjectId))];
      const allTopics = await this.prisma.topic.findMany({
        where: { subjectId: { in: uniqueSubjectIds } },
        select: { id: true, subjectId: true, name: true },
      });
      for (const topic of allTopics) {
        topicMap.set(`${topic.subjectId}:${topic.name.toLowerCase()}`, topic.id);
      }
    }

    // ── Build question create operations ───────────────────────────────────
    const questionCreates = resolvableRows.map((row) => {
      const topicKey = row.topic ? `${row.subjectId}:${row.topic.toLowerCase()}` : null;
      const topicId = topicKey ? (topicMap.get(topicKey) ?? null) : null;

      const options = [
        { label: 'A', text: row.optionA, isCorrect: row.correctOption === 'A', sortOrder: 0 },
        { label: 'B', text: row.optionB, isCorrect: row.correctOption === 'B', sortOrder: 1 },
        { label: 'C', text: row.optionC, isCorrect: row.correctOption === 'C', sortOrder: 2 },
        { label: 'D', text: row.optionD, isCorrect: row.correctOption === 'D', sortOrder: 3 },
      ];

      return this.prisma.question.create({
        data: {
          subjectId: row.subjectId,
          topicId,
          text: row.text,
          year: row.year ?? null,
          difficulty: row.difficulty,
          sourceType: 'IMPORTED',
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

    // ── Execute all creates in a single transaction ────────────────────────
    const created = questionCreates.length > 0
      ? (await this.prisma.$transaction(questionCreates)).length
      : 0;

    const allErrors = [...errorLog, ...subjectErrors];

    await this.prisma.import.update({
      where: { id: importRecord.id },
      data: {
        status: 'DONE',
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
