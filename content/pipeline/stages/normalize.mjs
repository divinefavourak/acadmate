// Stage: normalize (local, free). Load the JSON sources into canonical rows, map subjects, dedupe.
// Idempotent: rows are keyed by a stable id, and rows already in state keep their progress.
import fs from 'node:fs';
import path from 'node:path';
import { JSON_SOURCES, REPO_ROOT } from '../config.mjs';
import * as log from '../lib/log.mjs';
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
export const scopeKey = (r) =>
  `${r.subject}|${r.examType}|${r.school ?? ''}|${looseKey(r.text)}|${r.options.map(looseKey).sort().join('|')}`;

/**
 * Option texts in label order. An empty option before the last filled one would shift every later option
 * (and the key) when compacted, so such rows are rejected; a missing trailing E is fine.
 */
function orderedOptions(texts) {
  const trimmed = texts.map((t) => String(t ?? '').trim());
  const last = trimmed.findLastIndex(Boolean);
  const options = trimmed.slice(0, last + 1);
  return options.some((o) => !o) ? null : options;
}

function fromImportFormat(r) {
  const options = orderedOptions(LETTERS.map((l) => (typeof r[`option${l}`] === 'string' ? r[`option${l}`] : '')));
  return { options, key: LETTERS.includes(r.correctOption) ? r.correctOption : null };
}

function fromOptionsFormat(r) {
  const opts = [...(r.options ?? [])].sort((a, b) => String(a.label).localeCompare(String(b.label)));
  const options = orderedOptions(opts.map((o) => o.text));
  const correct = opts.map((o, i) => (o.isCorrect ? LETTERS[i] : null)).filter(Boolean);
  return { options, key: correct.length === 1 ? correct[0] : null };
}

export function runNormalize() {
  const rows = loadRows();
  // Rows are matched to earlier runs by source position (file#row): stable even after solve repairs the text.
  const byRef = new Map(rows.filter((r) => r.origin === 'json').map((r) => [r.sourceRef, r]));
  const seen = new Set(rows.map(scopeKey));
  const report = [];

  for (const src of JSON_SOURCES) {
    if (src.supersededBy) {
      // A better source (e.g. the PDF) now covers these questions: retire this file's rows so they don't
      // end up in the bank twice.
      let retired = 0;
      for (const r of rows) {
        if (r.origin !== 'json' || !r.sourceRef?.startsWith(`${src.file}#`) || r.superseded) continue;
        // Marked even if already rejected, so the dashboard doesn't count retired rows as failures.
        Object.assign(r, { status: 'discarded', superseded: true, discardReason: `superseded by ${src.supersededBy}` });
        retired++;
      }
      if (retired) report.push(`🗄  ${path.basename(src.file)}: ${retired} questions retired (${src.supersededBy} is used instead)`);
      continue;
    }
    if (src.enabled === false) continue;
    const file = path.join(REPO_ROOT, src.file);
    if (!fs.existsSync(file)) {
      report.push(`⚠️  ${path.basename(src.file)}: file not found, skipped`);
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
      if (!text || !options || options.length < 3) { unusable++; continue; }
      const sourceRef = `${src.file}#${i + 1}`;
      if (byRef.has(sourceRef)) continue; // already in state from an earlier run

      const row = makeRow({
        id: `j-${shortHash(`${src.file}:${looseKey(text)}|${options.map(looseKey).join('|')}`)}`,
        origin: 'json',
        sourceRef,
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

      const sk = scopeKey(row);
      if (seen.has(sk)) { dupes++; continue; }
      seen.add(sk);
      byRef.set(sourceRef, row);
      rows.push(row);
      added++;
    }
    // Only files that changed something are worth a line; re-runs are otherwise silent.
    if (added) {
      const extra = [dupes && `${dupes} already in another file`, unusable && `${unusable} unusable (missing options)`, unmapped && `${unmapped} unknown subject`].filter(Boolean);
      report.push(`➕ ${path.basename(src.file)}: ${added} new questions${extra.length ? ` (${extra.join(', ')})` : ''}`);
    }
  }

  saveRows(rows);
  log.stage('Loading the question files already in the repo (free)');
  for (const r of report) log.info(r);
  if (!report.length) log.info('Nothing new: every file is already loaded.');
  log.info(`📚 ${log.fmt.n(rows.filter((r) => r.status !== 'discarded').length)} questions in the pipeline.`);
}
