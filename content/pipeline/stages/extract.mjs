// Stage: extract (Sonnet). PDF pages or booklet photos → structured questions, with figures turned into images.
//
// Sources:
//   PDFs   → config.PDF_SOURCES (one subject per PDF, JAMB)
//   Photos → registered with --photos <dir> --school <ID> [--year N]; persisted in state/sources.json
//            (Post-UTME booklets mix subjects, so Claude labels each question's subject)
//
// Each request carries PDF_PAGES_PER_CHUNK pages with a 1-page overlap, so a question cut by a page break is
// whole in one of the two neighbouring requests; the prompt tells Claude to skip the cut-off copy.
import fs from 'node:fs';
import path from 'node:path';
import { EST_INPUT_TOKENS, EST_OUTPUT_TOKENS, MODELS, PDF_CHUNK_STRIDE, PDF_SOURCES, REPO_ROOT } from '../config.mjs';
import { collect, estimateCost, fitBudget, inFlight, params, submit } from '../lib/batch.mjs';
import { cropFromPdf, cropFromPhoto, prepPhoto, renderSvg, renderTable } from '../lib/figures.mjs';
import { chunkRanges, loadPdf, sliceBase64 } from '../lib/pdf.mjs';
import { loadRows, readJson, saveRows, writeJson } from '../lib/state.mjs';
import { LETTERS, looseKey, shortHash } from '../lib/util.mjs';
import { SUBJECTS } from '../syllabus.mjs';
import { makeRow, scopeKey } from './normalize.mjs';

const STAGE = 'extract';
const FIGURE_HEAVY = new Set(['MTH', 'PHY', 'CHM', 'BIO', 'ACC', 'GEO', 'AGR']);
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

// ── Sources ────────────────────────────────────────────────────────────────

function pdfSources() {
  return PDF_SOURCES.filter((s) => s.enabled !== false).map((s) => ({
    kind: 'pdf', key: s.subject, file: path.join(REPO_ROOT, s.file), subject: s.subject, examType: 'JAMB', school: null, year: null,
  }));
}

function photoSources() {
  return readJson('sources.json', []);
}

/** Register a folder of booklet photos (Post-UTME by default). */
export function registerPhotos({ dir, school, year, examType = 'POST_UTME' }) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) throw new Error(`photo folder not found: ${abs}`);
  if (examType === 'POST_UTME' && !school) throw new Error('--school is required for Post-UTME photos (e.g. --school UNILAG)');
  const files = fs.readdirSync(abs).filter((f) => IMAGE_EXT.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) // img2 before img10
    .map((f) => path.join(abs, f));
  if (files.length === 0) throw new Error(`no .jpg/.png/.webp photos in ${abs}`);

  const key = `ph-${shortHash(abs)}`;
  const sources = photoSources().filter((s) => s.key !== key);
  sources.push({ kind: 'photos', key, dir: abs, files, subject: null, examType, school: school?.toUpperCase() ?? null, year: year ? Number(year) : null });
  writeJson('sources.json', sources);
  console.log(`registered ${files.length} photos from ${abs} as ${key} (${examType}${school ? ` · ${school}` : ''}${year ? ` · ${year}` : ''})`);
  return key;
}

const allSources = () => [...pdfSources(), ...photoSources()];

// ── Schema & prompt ────────────────────────────────────────────────────────

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

const SCHEMA = obj({
  passages: { type: 'array', items: obj({ id: { type: 'string' }, text: { type: 'string' } }) },
  questions: {
    type: 'array',
    items: obj({
      number: nullable({ type: 'integer' }),
      year: nullable({ type: 'integer' }),
      subject: { type: 'string', enum: Object.keys(SUBJECTS) },
      page: { type: 'integer' },
      passageId: nullable({ type: 'string' }),
      text: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      answer: nullable({ type: 'string', enum: LETTERS }),
      figure: nullable(obj({
        kind: { type: 'string', enum: ['table', 'diagram', 'picture'] },
        page: { type: 'integer' },
        bbox: obj({ x0: { type: 'number' }, y0: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' } }),
        html: nullable({ type: 'string' }),
        svg: nullable({ type: 'string' }),
      })),
      unreadable: { type: 'boolean' },
    }),
  },
  answerKey: { type: 'array', items: obj({ year: nullable({ type: 'integer' }), number: { type: 'integer' }, answer: { type: 'string', enum: LETTERS } }) },
});

const SYSTEM = `You transcribe Nigerian exam past-question booklets (JAMB UTME and university Post-UTME) into structured data for a CBT practice website. Accuracy matters more than speed: students learn from what you write.

Extract the multiple-choice questions that START on the pages the user names (the excerpt may include one extra page after them, only so a question that runs over a page break can be read to its end).
- Skip questions that start on that extra page, or that started before the first page: the neighbouring excerpt captures them.
- number: the printed question number. year: the paper's year from the nearest heading ABOVE the question within this excerpt (e.g. "JAMB 2010", "UTME 2015"); null if no heading is visible above it here.
- subject: the subject code the question belongs to. ${Object.entries(SUBJECTS).map(([c, n]) => `${c}=${n}`).join(', ')}. Use GEN for general paper / current affairs / general studies.
- page: the 1-based page (or photo) within this excerpt where the question starts.
- text: the question stem exactly as printed, minus the number. options: the option texts in order WITHOUT their letter labels; keep all of them (4 or 5).
- answer: ONLY if the booklet prints or marks the answer for this question; otherwise null. Never solve it yourself.
- answerKey: any answer-key table or list on these pages (e.g. "1. B 2. D"), with its year if shown.
- passages: comprehension / cloze passages, each once, with a short id; questions on a passage set passageId. Don't repeat the passage inside the question text.
- Formatting: write maths, chemical formulas and units with super/subscripts as LaTeX inside $...$ (e.g. $x^2$, $\\mathrm{H_2SO_4}$, $9.8\\,\\mathrm{m/s^2}$). Underlined words as _word_. Keep blanks as ____.
- Drop publisher branding, watermarks, ads and URLs (e.g. "Download MySchoolGist JAMB CBT Software from …").
- unreadable: true if blur, glare, a cut-off edge or damage stops you transcribing the question or its figure faithfully. Still give your best transcription.

figure — set only when the question cannot be answered without a visual (in the stem or as the options); otherwise null:
- page: 1-based page within the excerpt the figure is on. bbox: the figure's box as fractions of that page (0–1, origin top-left), generous enough to include its labels; if the options are themselves figures, cover them too.
- kind "table": a data/accounts table → html: a plain <table> with <th>/<td> (and <caption> if printed), no styles, exactly the printed values. svg: null.
- kind "diagram": a line drawing you can redraw faithfully — graph, geometric figure, circuit, ray/wave diagram, apparatus outline, structural formula, Venn diagram → svg: one self-contained <svg> with width and height attributes (≤ 700×500) and a matching viewBox, black strokes on transparent, every label and value as printed. html: null.
- kind "picture": anything you cannot redraw faithfully — specimens, organisms, photographs, maps, detailed drawings → html and svg null (it will be cropped from the page).
- If the options are figures, set options to ["Figure A", "Figure B", …] matching their labels.`;

// ── Requests ───────────────────────────────────────────────────────────────

const doneChunks = (key) => readJson(`extract/${key}.json`, { chunks: {} }).chunks;

/** "300-694" → { from: 300, to: 694 } (1-based, inclusive). */
function parsePages(spec) {
  if (!spec) return null;
  const m = /^(\d+)-(\d+)$/.exec(String(spec));
  if (!m) throw new Error(`--pages must look like 300-694, got "${spec}"`);
  return { from: Number(m[1]), to: Number(m[2]) };
}

async function buildRequests(src, { limitChunks, pages: pageSpec }) {
  const done = doneChunks(src.key);
  const flying = inFlight(STAGE);
  let doc = null;
  const pageCount = src.kind === 'pdf' ? (doc = await loadPdf(src.file)).getPageCount() : src.files.length;

  const failed = failures();
  const state = readJson(`extract/${src.key}.json`, { chunks: {} });
  if (state.totalChunks !== chunkRanges(pageCount).length) {
    state.totalChunks = chunkRanges(pageCount).length; // lets `solve` tell when a source is fully extracted
    writeJson(`extract/${src.key}.json`, state);
  }
  const window = parsePages(pageSpec);
  const ranges = chunkRanges(pageCount).filter(({ start, end }) => {
    const id = `x-${src.key}-${start}`;
    const inWindow = !window || (end >= window.from && start + 1 <= window.to);
    return inWindow && !done[start] && !flying.has(id) && !failed[id]?.permanent;
  });
  const requests = [];
  for (const { start, end } of ranges.slice(0, limitChunks ?? ranges.length)) {
    const pages = end - start;
    const content =
      src.kind === 'pdf'
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await sliceBase64(doc, start, end) } }]
        : src.files.slice(start, end).flatMap((f, i) => [
          { type: 'text', text: `Photo ${i + 1}:` },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: prepPhoto(f) } },
        ]);
    const where = src.kind === 'pdf'
      ? `Pages ${start + 1}–${end} of ${pageCount} of a ${SUBJECTS[src.subject]} JAMB past-question booklet.`
      : `Photos ${start + 1}–${end} of ${pageCount} of a ${src.school ?? ''} ${src.examType === 'POST_UTME' ? 'Post-UTME' : ''} past-question booklet${src.year ? ` (${src.year})` : ''}. Treat each photo as a page.`;
    // The last page overlaps the next chunk; only the final chunk owns all of its pages.
    const owned = end === pageCount ? pages : Math.min(PDF_CHUNK_STRIDE, pages);
    const unit = src.kind === 'pdf' ? 'page' : 'photo';
    const scope = owned === pages
      ? `Extract the questions that start on any of these ${pages} ${unit}s.`
      : `Extract the questions that start on ${unit}s 1–${owned} of this excerpt; ${unit} ${pages} is only there to finish them.`;
    content.push({ type: 'text', text: `${where} ${scope}` });

    const figures = src.subject ? FIGURE_HEAVY.has(src.subject) : true;
    requests.push({
      custom_id: `x-${src.key}-${start}`,
      params: params({ model: MODELS.worker, system: SYSTEM, content, schema: SCHEMA, effort: figures ? 'medium' : 'low', maxTokens: 48000 }),
      estUsd: estimateCost(MODELS.worker, 1800 + pages * EST_INPUT_TOKENS.pdfPage, owned * EST_OUTPUT_TOKENS.extractPage),
    });
  }
  return requests;
}

// ── Assembly: chunk results → rows ─────────────────────────────────────────

function figureImage(src, q, chunkStart) {
  const f = q.figure;
  try {
    if (f.kind === 'table' && f.html) return renderTable(f.html);
    if (f.kind === 'diagram' && f.svg) return renderSvg(f.svg);
    const absPage = chunkStart + (f.page || q.page) - 1;
    return src.kind === 'pdf' ? cropFromPdf(src.file, absPage, f.bbox) : cropFromPhoto(src.files[absPage], f.bbox);
  } catch (err) {
    console.warn(`  figure failed (${src.key} p${chunkStart + q.page}): ${err.message.split('\n')[0]}`);
    return null;
  }
}

/**
 * Split a source's extracted chunks into papers. A booklet is a run of papers (one per year), each numbered
 * from 1 with its answer key printed at its end, so question numbers and keys only mean something within a
 * paper. A new paper starts at a year heading that differs, when numbering resets, or after a gap between
 * extracted chunks (we can't know what was in the pages we skipped).
 */
function splitPapers(src, chunks) {
  const starts = Object.keys(chunks).map(Number).sort((a, b) => a - b);
  const papers = [];
  let paper = null;
  const open = (year) => papers.push((paper = { year, maxNum: 0, entries: [], keys: new Map() }));
  let prevStart = null;

  for (const start of starts) {
    if (prevStart === null || start !== prevStart + PDF_CHUNK_STRIDE) open(src.year);
    prevStart = start;
    const res = chunks[start];
    const passages = new Map(res.passages.map((p) => [p.id, p.text]));

    for (const q of res.questions) {
      const headingChange = q.year != null && q.year !== paper.year;
      const numberingReset = q.number != null && paper.maxNum > 0 && q.number < paper.maxNum - 20;
      if (paper.entries.length && (headingChange || numberingReset)) open(q.year ?? src.year);
      else if (q.year != null) paper.year = q.year;
      paper.entries.push({ q, start, passages });
      if (q.number != null) paper.maxNum = Math.max(paper.maxNum, q.number);
    }

    // A key block belongs to the most recent paper that's long enough to own it: when paper N's key shares a
    // chunk with the first questions of paper N+1, N+1 is still too short, so the block goes back to N.
    for (const [kYear, block] of Map.groupBy(res.answerKey, (k) => k.year ?? null)) {
      const maxKey = Math.max(...block.map((k) => k.number));
      let target = null;
      for (let i = papers.length - 1; i >= 0 && !target; i--) {
        const p = papers[i];
        if (kYear != null ? p.year === kYear : p.maxNum >= maxKey * 0.8) target = p;
      }
      target ??= paper;
      for (const k of block) if (!target.keys.has(k.number)) target.keys.set(k.number, k.answer);
    }
  }
  return papers;
}

function assemble(src) {
  const papers = splitPapers(src, doneChunks(src.key));
  const rows = loadRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const byScope = new Map(rows.map((r) => [scopeKey(r), r]));
  // Solve may repair a row's text/options, which changes its scopeKey; extractKey is the as-extracted one.
  const byExtract = new Map(rows.filter((r) => r.extractKey).map((r) => [r.extractKey, r]));
  let added = 0, refreshed = 0, keysAttached = 0, reopened = 0, figs = 0, flagged = 0;

  /** Re-assembly corrects rows from earlier runs: their year, and keys printed on pages extracted since. */
  const refresh = (row, year, key) => {
    if (row.year !== year) { row.year = year; refreshed++; }
    if (!key || row.key) return;
    row.key = key;
    keysAttached++;
    if (row.status === 'needs_verify' && !row.verify && row.solve?.answer === key) {
      // Queued only for lack of a key; booklet and Sonnet now agree.
      Object.assign(row, { status: 'accepted', answer: key, explanation: row.solve.explanation });
    } else if (row.status === 'accepted' && row.answeredBy === 'sonnet' && row.answer !== key) {
      // Sonnet answered alone and the booklet now disagrees: let Opus settle it.
      Object.assign(row, { status: 'needs_verify', answer: null, answeredBy: null });
      reopened++;
    } else if (row.answeredBy === 'sonnet' && row.answer === key) {
      row.answeredBy = null; // now backed by the booklet too
    }
  };

  for (const paper of papers) {
    for (const { q, start, passages } of paper.entries) {
      const subject = src.subject ?? q.subject;
      const passage = q.passageId ? passages.get(q.passageId) : null;
      const text = passage ? `PASSAGE:\n${passage}\n\nQUESTION: ${q.text}` : q.text;
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      const key = q.answer ?? (q.number != null ? paper.keys.get(q.number) ?? null : null);
      // Text-based id: stable however much of the booklet has been extracted (year and numbering aren't).
      const id = `p-${src.key}-${shortHash(`${subject}:${looseKey(text)}`)}`;

      if (byId.has(id)) { refresh(byId.get(id), paper.year, key); continue; }
      const draft = makeRow({
        id, origin: 'pdf', subject, examType: src.examType, school: src.school, year: paper.year, text, options, key,
        sourceRef: `${path.basename(src.file ?? src.dir)}#${src.kind === 'pdf' ? 'p' : 'photo'}${start + q.page}${q.number != null ? `-q${q.number}` : ''}`,
      });
      draft.extractKey = scopeKey(draft);
      // Rows from the first pilot used year:number ids and predate extractKey.
      const legacyId = paper.year != null && q.number != null ? `p-${src.key}-${shortHash(`${subject}:${paper.year}:${q.number}`)}` : null;
      const existing = byExtract.get(draft.extractKey) ?? (legacyId && byId.get(legacyId)) ?? byScope.get(draft.extractKey);
      if (existing) {
        // Same question already known: an earlier run of this source under an old id, or another source.
        if (sourceKeyOf(existing) === src.key) {
          existing.extractKey ??= draft.extractKey;
          refresh(existing, paper.year, key);
        }
        continue;
      }
      draft.imageUrl = q.figure ? figureImage(src, q, start) : null;
      draft.needsImage = Boolean(q.figure && !draft.imageUrl) || q.unreadable;
      if (draft.imageUrl) figs++;
      if (draft.needsImage) flagged++;
      rows.push(draft);
      byId.set(id, draft);
      byScope.set(scopeKey(draft), draft);
      byExtract.set(draft.extractKey, draft);
      added++;
    }
  }
  saveRows(rows);

  const years = papers.map((p) => p.year ?? '?');
  console.log(
    `assembled ${src.key}: ${papers.length} paper(s) [${years.join(', ')}] · +${added} rows (${figs} figures, ${flagged} need attention)` +
      (refreshed || keysAttached ? ` · updated ${refreshed} years, attached ${keysAttached} keys` : '') +
      (reopened ? ` · ${reopened} Sonnet answers contradicted by the booklet → back to verify` : ''),
  );
}

/** Source key of a row assembled by this stage (ids look like p-<sourceKey>-<hash>). */
export const sourceKeyOf = (row) => (row.origin === 'pdf' ? row.id.split('-').slice(1, -1).join('-') : null);

/** True once every chunk of the source has a result or has been given up on, i.e. all answer keys are in. */
export function sourceComplete(key) {
  const state = readJson(`extract/${key}.json`, { chunks: {} });
  if (!state.totalChunks) return false;
  const failed = Object.keys(failures()).filter((id) => id.startsWith(`x-${key}-`) && failures()[id].permanent).length;
  return Object.keys(state.chunks).length + failed >= state.totalChunks;
}

// ── Stage entry ────────────────────────────────────────────────────────────

export async function runExtract({ subjects, sourceKeys, limitChunks, pages, budget, dryRun, wait = true }) {
  const sources = allSources().filter((s) =>
    sourceKeys ? sourceKeys.includes(s.key) : subjects ? (s.subject ? subjects.includes(s.subject) : false) : true);
  if (sources.length === 0) {
    console.log('no matching sources (photo folders are selected with --source <key>; see `status`)');
    return;
  }

  // Ingest anything that finished while we were away before deciding what's left to send.
  await collect(STAGE, ingest, { wait: false });

  const requests = [];
  for (const src of sources) requests.push(...(await buildRequests(src, { limitChunks, pages })));
  await submit(STAGE, fitBudget(requests, budget), { dryRun });

  if (wait && !dryRun) await collect(STAGE, ingest);
  for (const src of sources) assemble(src);
}

const failures = () => readJson('extract/failures.json', {});

function ingest(customId, outcome) {
  const [, ...rest] = customId.split('-');
  const start = Number(rest.pop());
  const key = rest.join('-');
  if (!outcome.ok) {
    const f = failures();
    const attempts = (f[customId]?.attempts ?? 0) + 1;
    // Retry transient failures once more; after that (or for refusals/invalid requests) stop paying for it.
    f[customId] = { error: outcome.error, attempts, permanent: !outcome.retryable || attempts >= 2 };
    writeJson('extract/failures.json', f);
    console.warn(`  ${customId} failed: ${outcome.error}${outcome.retryable ? ' (will retry on next run)' : ''}`);
    return;
  }
  const state = readJson(`extract/${key}.json`, { chunks: {} });
  state.chunks[start] = outcome.json;
  writeJson(`extract/${key}.json`, state);
}
