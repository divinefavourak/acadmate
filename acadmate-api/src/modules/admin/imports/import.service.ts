import { Injectable } from '@nestjs/common';
import type { ExamType, Prisma, SourceType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { isUniqueViolation, normaliseForIdentity, questionContentHash } from './question-identity';

// ─── Types (identical to lib/validation/admin.ts importRowSchema shape) ──────
export type ImportRowError = { row: number; errors: string[] };

export type ProcessImportParams = {
  adminId: string;
  filename: string;
  rows: unknown[];
  /** Batch defaults; a row's own examType/school wins. */
  examType?: string;
  school?: string;
  /** Create topics that don't exist yet instead of importing the question without one. */
  createMissingTopics?: boolean;
};

export type ProcessImportResult = {
  importId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  created: number;
  /** Rows skipped because the same question is already in the bank (or earlier in the file). */
  duplicates: number;
  topicsCreated: number;
  errors: ImportRowError[];
};

const EXAM_TYPES = ['JAMB', 'WAEC', 'POST_UTME'] as const;
const SOURCE_TYPES = ['IMPORTED', 'AI_ASSISTED'] as const;
/** Creates per transaction. Re-importing is safe (dedupe), so a failed chunk can simply be retried. */
const CHUNK_SIZE = 250;

type ImportRow = {
  /** 1-based position in the uploaded file, kept for error messages. */
  rowNum: number;
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
  /** An https link, or an image embedded as a base64 data URI (uploaded on import). */
  imageUrl?: string;
  examType?: ExamType;
  school?: string;
  sourceType: SourceType;
  aiAssisted: boolean;
  explanationReviewed: boolean;
  sourceRef?: string;
  /** Import as a flagged draft that needs a human (e.g. its figure couldn't be captured). */
  flagged: boolean;
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function validateImportRow(
  raw: unknown,
  rowNum: number,
  defaults: { examType?: string; school?: string },
): { data: ImportRow; errors: null } | { data: null; errors: ImportRowError } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (!str(r.subject)) errors.push('subject: Required string');
  if (!str(r.text)) errors.push('text: Required string');
  for (const k of ['optionA', 'optionB', 'optionC', 'optionD']) {
    if (!str(r[k])) errors.push(`${k}: Required string`);
  }
  if (!['A', 'B', 'C', 'D'].includes(r.correctOption as string)) {
    errors.push('correctOption: Must be A, B, C, or D');
  }

  const difficulty = (r.difficulty as string) ?? 'MEDIUM';
  if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
    errors.push('difficulty: Must be EASY, MEDIUM, or HARD');
  }

  const imageUrl = typeof r.imageUrl === 'string' ? r.imageUrl.trim() : '';
  if (r.imageUrl != null && r.imageUrl !== '' && !/^(https?:\/\/|data:image\/)/i.test(imageUrl)) {
    errors.push('imageUrl: Must be an http(s) link or a data:image/…;base64 image');
  }

  const examType = str(r.examType) ?? defaults.examType;
  if (examType && !(EXAM_TYPES as readonly string[]).includes(examType)) {
    errors.push(`examType: Must be one of ${EXAM_TYPES.join(', ')}`);
  }
  const school = str(r.school) ?? defaults.school;
  if (examType === 'POST_UTME' && !school) errors.push('school: Required for POST_UTME questions');

  const sourceType = str(r.sourceType) ?? 'IMPORTED';
  if (!(SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    errors.push(`sourceType: Must be one of ${SOURCE_TYPES.join(', ')}`);
  }

  const year = r.year != null && r.year !== '' ? Number(r.year) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 1970 || year > 2100)) {
    errors.push('year: Must be a whole year between 1970 and 2100');
  }

  if (errors.length > 0) return { data: null, errors: { row: rowNum, errors } };

  return {
    data: {
      rowNum,
      subject: str(r.subject)!,
      topic: str(r.topic),
      text: (r.text as string).trim(),
      optionA: (r.optionA as string).trim(),
      optionB: (r.optionB as string).trim(),
      optionC: (r.optionC as string).trim(),
      optionD: (r.optionD as string).trim(),
      correctOption: r.correctOption as ImportRow['correctOption'],
      explanation: str(r.explanation),
      year,
      difficulty: difficulty as ImportRow['difficulty'],
      imageUrl: imageUrl || undefined,
      examType: examType as ExamType | undefined,
      school,
      sourceType: sourceType as SourceType,
      // AI-generated rows are always marked AI-assisted, whatever the file says.
      aiAssisted: sourceType === 'AI_ASSISTED' || r.aiAssisted === true,
      explanationReviewed: r.explanationReviewed === true,
      sourceRef: str(r.sourceRef),
      flagged: r.flagged === true,
    },
    errors: null,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
  ) {}

  /**
   * Questions created before contentHash existed (or by hand in the builder) have no hash, so dedupe can't see
   * them. Hash them on the way in; after the first import this finds nothing and costs one empty query.
   * When the bank already holds duplicates, only the first copy gets the hash (the column is unique).
   */
  private async backfillMissingHashes(): Promise<void> {
    const taken = new Set<string>();
    for (;;) {
      const batch = await this.prisma.question.findMany({
        where: { contentHash: null, id: { notIn: [...this.unhashable] } },
        select: {
          id: true, subjectId: true, text: true, examType: true, school: true, imageUrl: true,
          options: { select: { text: true } },
        },
        take: 500,
      });
      if (batch.length === 0) return;

      for (const q of batch) {
        const hash = questionContentHash({ ...q, options: q.options.map((o) => o.text) });
        const clash = taken.has(hash) || (await this.prisma.question.count({ where: { contentHash: hash } })) > 0;
        if (clash) {
          this.unhashable.add(q.id);
          continue;
        }
        await this.prisma.question.update({ where: { id: q.id }, data: { contentHash: hash } });
        taken.add(hash);
      }
    }
  }

  /** Existing duplicates that can't take a hash; remembered so the backfill loop doesn't revisit them. */
  private readonly unhashable = new Set<string>();

  async processImport(params: ProcessImportParams): Promise<ProcessImportResult> {
    const { adminId, filename, rows } = params;

    await this.backfillMissingHashes();

    const importRecord = await this.prisma.import.create({
      data: {
        uploadedById: adminId,
        filename,
        format: filename.endsWith('.csv') ? 'CSV' : 'JSON',
        status: 'PROCESSING',
        totalRows: rows.length,
      },
    });

    // An import never stays PROCESSING: anything unexpected marks it FAILED with the reason, then rethrows.
    // (Questions already saved stay; re-running the file skips them as duplicates.)
    try {
      return await this.runImport(importRecord.id, params);
    } catch (err) {
      await this.prisma.import
        .update({ where: { id: importRecord.id }, data: { status: 'FAILED', errorLog: [{ row: 0, errors: [(err as Error).message] }] } })
        .catch(() => {});
      throw err;
    }
  }

  private async runImport(importId: string, params: ProcessImportParams): Promise<ProcessImportResult> {
    const { rows, examType, school, createMissingTopics = false } = params;

    // ── Validate all rows upfront ─────────────────────────────────────────
    const validRows: ImportRow[] = [];
    const errorLog: ImportRowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = validateImportRow(rows[i], i + 1, { examType, school });
      if (result.errors) errorLog.push(result.errors);
      else validRows.push(result.data);
    }

    // ── Resolve subjects (single query) ────────────────────────────────────
    // Rows may name a subject by its name or its code ("Use of English" or "ENG"), in any case.
    const subjects = await this.prisma.subject.findMany({ select: { id: true, name: true, code: true } });
    const subjectMap = new Map<string, string>();
    for (const s of subjects) {
      subjectMap.set(s.name.toLowerCase(), s.id);
      subjectMap.set(s.code.toLowerCase(), s.id);
    }

    const resolvableRows: Array<ImportRow & { subjectId: string; contentHash: string }> = [];
    const subjectErrors: ImportRowError[] = [];

    for (const row of validRows) {
      const subjectId = subjectMap.get(row.subject.toLowerCase());
      if (!subjectId) {
        subjectErrors.push({ row: row.rowNum, errors: [`Subject not found: "${row.subject}"`] });
        continue;
      }
      // Hashed before upload: an embedded image's fingerprint is its bytes, so re-importing a file matches.
      const contentHash = questionContentHash({
        subjectId,
        text: row.text,
        options: [row.optionA, row.optionB, row.optionC, row.optionD],
        examType: row.examType,
        school: row.school,
        imageUrl: row.imageUrl,
      });
      resolvableRows.push({ ...row, subjectId, contentHash });
    }

    // ── Dedupe: within the file, then against the bank ────────────────────
    const seen = new Set<string>();
    const existing = new Set<string>();
    for (const hashes of chunk(resolvableRows.map((r) => r.contentHash), 1000)) {
      const found = await this.prisma.question.findMany({
        where: { contentHash: { in: hashes } },
        select: { contentHash: true },
      });
      for (const f of found) existing.add(f.contentHash!);
    }
    const uniqueRows = resolvableRows.filter((r) => {
      if (existing.has(r.contentHash) || seen.has(r.contentHash)) return false;
      seen.add(r.contentHash);
      return true;
    });
    const duplicates = resolvableRows.length - uniqueRows.length;

    // ── Resolve topics (optionally creating missing ones) ─────────────────
    const topicKey = (subjectId: string, name: string) => `${subjectId}:${name.toLowerCase()}`;
    const topicMap = new Map<string, string>();
    let topicsCreated = 0;

    const wanted = uniqueRows.filter((r): r is typeof r & { topic: string } => Boolean(r.topic));
    if (wanted.length > 0) {
      const subjectIds = [...new Set(wanted.map((t) => t.subjectId))];
      const loadTopics = async () => {
        const all = await this.prisma.topic.findMany({
          where: { subjectId: { in: subjectIds } },
          select: { id: true, subjectId: true, name: true },
        });
        for (const t of all) topicMap.set(topicKey(t.subjectId, t.name), t.id);
      };
      await loadTopics();

      if (createMissingTopics) {
        const missing = new Map<string, { subjectId: string; name: string }>();
        for (const r of wanted) {
          const key = topicKey(r.subjectId, r.topic);
          if (!topicMap.has(key) && !missing.has(key)) missing.set(key, { subjectId: r.subjectId, name: r.topic });
        }
        if (missing.size > 0) {
          const res = await this.prisma.topic.createMany({ data: [...missing.values()], skipDuplicates: true });
          topicsCreated = res.count;
          await loadTopics();
        }
      }
    }

    // ── Upload embedded images ─────────────────────────────────────────────
    // A row whose image can't be used is reported and skipped; the rest still import.
    const imageErrors: ImportRowError[] = [];
    const importableRows: typeof uniqueRows = [];
    const uploaded = new Map<string, string>();
    for (const row of uniqueRows) {
      if (row.imageUrl?.startsWith('data:')) {
        try {
          if (!uploaded.has(row.imageUrl)) {
            uploaded.set(row.imageUrl, (await this.upload.uploadDataUri(row.imageUrl, 'questions')).url);
          }
          row.imageUrl = uploaded.get(row.imageUrl);
        } catch (err) {
          imageErrors.push({ row: row.rowNum, errors: [`imageUrl: ${(err as Error).message}`] });
          continue;
        }
      }
      importableRows.push(row);
    }

    // ── Build question creates ─────────────────────────────────────────────
    const toCreate = (row: (typeof importableRows)[number]): Prisma.QuestionCreateArgs => {
      const optionTexts = [row.optionA, row.optionB, row.optionC, row.optionD];
      const options = optionTexts.map((text, i) => {
        const label = 'ABCD'[i];
        return { label, text, isCorrect: row.correctOption === label, sortOrder: i };
      });
      // Two options that read the same make the question unanswerable: import it, but flag it for review.
      const hasDuplicateOptions = new Set(optionTexts.map(normaliseForIdentity)).size < optionTexts.length;

      return {
        data: {
          subjectId: row.subjectId,
          topicId: row.topic ? (topicMap.get(topicKey(row.subjectId, row.topic)) ?? null) : null,
          text: row.text,
          imageUrl: row.imageUrl ?? null,
          year: row.year ?? null,
          difficulty: row.difficulty,
          sourceType: row.sourceType,
          sourceRef: row.sourceRef ?? null,
          aiAssisted: row.aiAssisted,
          contentHash: row.contentHash,
          isPublished: false,
          isFlagged: hasDuplicateOptions || row.flagged,
          importId,
          examType: row.examType ?? null,
          school: row.school ?? null,
          options: { create: options },
          ...(row.explanation && {
            explanation: {
              create: { text: row.explanation, aiAssisted: row.aiAssisted, reviewed: row.explanationReviewed },
            },
          }),
        },
        select: { id: true },
      };
    };

    // ── Execute in chunked transactions ────────────────────────────────────
    // If a chunk fails (e.g. another import created one of these questions a moment ago, so the unique hash
    // collides), redo that chunk row by row: a collision counts as a duplicate, anything else as a row error.
    let created = 0;
    let lateDuplicates = 0;
    const writeErrors: ImportRowError[] = [];
    for (const part of chunk(importableRows, CHUNK_SIZE)) {
      try {
        const results = await this.prisma.$transaction(part.map((row) => this.prisma.question.create(toCreate(row))));
        created += results.length;
      } catch {
        for (const row of part) {
          try {
            await this.prisma.question.create(toCreate(row));
            created++;
          } catch (err) {
            if (isUniqueViolation(err)) lateDuplicates++;
            else writeErrors.push({ row: row.rowNum, errors: [`save failed: ${(err as Error).message.split('\n').pop()}`] });
          }
        }
      }
    }

    const allErrors = [...errorLog, ...subjectErrors, ...imageErrors, ...writeErrors].sort((a, b) => a.row - b.row);

    await this.prisma.import.update({
      where: { id: importId },
      data: {
        status: 'DONE',
        validRows: validRows.length,
        invalidRows: rows.length - validRows.length,
        publishedRows: 0,
        errorLog: allErrors.length > 0 ? allErrors : undefined,
      },
    });

    return {
      importId,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.length - validRows.length,
      created,
      duplicates: duplicates + lateDuplicates,
      topicsCreated,
      errors: allErrors,
    };
  }
}
