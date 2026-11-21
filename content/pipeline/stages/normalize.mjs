// Stage: normalize (local, free). Load the JSON sources into canonical rows, map subjects, dedupe.
// Idempotent: rows are keyed by a stable id, and rows already in state keep their progress.
import fs from 'node:fs';
import path from 'node:path';
import { JSON_SOURCES, REPO_ROOT } from '../config.mjs';
import { loadRows, saveRows } from '../lib/state.mjs';
import { LETTERS, looseKey, shortHash } from '../lib/util.mjs';
import { subjectCode } from '../syllabus.mjs';

/** Canonical row. Every stage after this works on this shape only. */
export function makeRow(fields) {
  return {
    id: fields.id,
    origin: fields.origin, // json | pdf | gen
    sourceRef: fields.sourceRef ?? null,
    subject: fields.subject,
    examType: fields.examType,
    school: fields.school ?? null,
    year: fields.year ?? null,
    text: fields.text,
    options: fields.options,
    key: fields.key ?? null, // answer printed in the source, if any
    answer: null, // final, verified answer (set when status becomes "accepted")
    explanation: fields.explanation ?? null,
    topic: fields.topic ?? null,
    difficulty: fields.difficulty ?? null,
    sourceType: fields.sourceType ?? 'IMPORTED',
    imageUrl: fields.imageUrl ?? null,
    needsImage: fields.needsImage ?? false,
    status: fields.status ?? 'new',
    discardReason: null,
    solve: fields.solve ?? null,
    verify: null,
  };
}

/** Dedupe scope: the same question may legitimately exist for JAMB and for a given school's Post-UTME. */
export const scopeKey = (r) => `${r.examType}|${r.school ?? ''}|${looseKey(r.text)}|${r.options.map(looseKey).sort().join('|')}`;

function fromImportFormat(r) {
  const options = LETTERS.map((l) => r[`option${l}`]).filter((o) => typeof o === 'string' && o.trim());
  return { options, key: LETTERS.includes(r.correctOption) ? r.correctOption : null };
}

function fromOptionsFormat(r) {
  const opts = [...(r.options ?? [])].sort((a, b) => String(a.label).localeCompare(String(b.label)));
  const options = opts.map((o) => String(o.text ?? '').trim()).filter(Boolean);
  const correct = opts.map((o, i) => (o.isCorrect ? LETTERS[i] : null)).filter(Boolean);
  return { options, key: correct.length === 1 ? correct[0] : null };
}

export function runNormalize() {
  const rows = loadRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set(rows.map(scopeKey));
  const report = [];

  for (const src of JSON_SOURCES) {
    if (src.enabled === false) continue;
    const file = path.join(REPO_ROOT, src.file);
    if (!fs.existsSync(file)) {
      report.push(`${src.file}: missing, skipped`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let added = 0, dupes = 0, unmapped = 0, unusable = 0;

    for (const [i, r] of data.entries()) {
      const examType = src.postUtmeSubjects?.includes(r.subject) ? 'POST_UTME' : src.examType;
      const subject = subjectCode(r.subject, examType);
      if (!subject) { unmapped++; continue; }
      const text = String(r.text ?? '').trim();
      const { options, key } = src.format === 'import' ? fromImportFormat(r) : fromOptionsFormat(r);
      if (!text || options.length < 3) { unusable++; continue; }

      const row = makeRow({
        id: `j-${shortHash(`${src.file}:${looseKey(text)}`)}`,
        origin: 'json',
        sourceRef: `${src.file}#${i + 1}`,
        subject,
        examType,
        school: src.school ?? r.school ?? null,
        year: src.keepYear === false ? null : (Number.isInteger(Number(r.year)) && r.year ? Number(r.year) : null),
        text,
        options,
        key,
        explanation: typeof r.explanation === 'string' && r.explanation.trim() ? r.explanation.trim() : null,
        topic: r.topic ?? null,
        difficulty: r.difficulty ?? null,
        sourceType: src.sourceType ?? 'IMPORTED',
        imageUrl: typeof r.imageUrl === 'string' && /^https?:\/\//.test(r.imageUrl) ? r.imageUrl : null,
      });

      if (byId.has(row.id)) continue; // already in state from an earlier run
      const sk = scopeKey(row);
      if (seen.has(sk)) { dupes++; continue; }
      seen.add(sk);
      byId.set(row.id, row);
      rows.push(row);
      added++;
    }
    report.push(`${src.file}: +${added} rows, ${dupes} duplicates, ${unmapped} unknown subject, ${unusable} unusable`);
  }

  saveRows(rows);
  console.log(report.join('\n'));
  console.log(`rows in state: ${rows.length}`);
}
