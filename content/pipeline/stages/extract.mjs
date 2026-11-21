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
import * as log from '../lib/log.mjs';
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
  log.ok(`Added ${files.length} photos from ${abs} (${examType === 'POST_UTME' ? 'Post-UTME' : examType}${school ? ` · ${school}` : ''}${year ? ` · ${year}` : ''}).`);
  log.info(`Next: node content/pipeline/run.mjs extract --source ${key}`);
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

Extract the multiple-choice questions that START on the pages the user names. The excerpt may also include one context page BEFORE them (so you can see a passage, table or figure that those questions refer to) and one page AFTER them (so a question that runs over a page break can be read to its end).
- Never extract questions that start on a context page: the neighbouring excerpts capture them.
- If a question you extract depends on a passage or figure printed on the context page before, still include that passage in passages (and the figure, with its page) — the question must be answerable on its own.
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

/** First page sent for a chunk: one context page before it, except at the very start of the document. */
const contextStart = (start) => Math.max(0, start - 1);

/**
 * Absolute 0-based page of a 1-based excerpt page. Chunk results record the first page they were sent
 * (firstPage); results from before context pages existed don't, and began at their chunk start.
 */
const absPage = (chunk, start, excerptPage) => (chunk.firstPage ?? start) + excerptPage - 1;

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
    // One context page before the chunk (a passage or figure on it may belong to the chunk's questions).
    const first = contextStart(start);
    const pages = end - first;
    const content =
      src.kind === 'pdf'
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await sliceBase64(doc, first, end) } }]
        : src.files.slice(first, end).flatMap((f, i) => [
          { type: 'text', text: `Photo ${i + 1}:` },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: prepPhoto(f) } },
        ]);
    const where = src.kind === 'pdf'
      ? `Pages ${first + 1}–${end} of ${pageCount} of a ${SUBJECTS[src.subject]} JAMB past-question booklet.`
      : `Photos ${first + 1}–${end} of ${pageCount} of a ${src.school ?? ''} ${src.examType === 'POST_UTME' ? 'Post-UTME' : ''} past-question booklet${src.year ? ` (${src.year})` : ''}. Treat each photo as a page.`;
    // Owned pages: the chunk's stride. A context page before, and the overlap page after, are read-only.
    const ctx = start - first;
    const ownedCount = end === pageCount ? end - start : Math.min(PDF_CHUNK_STRIDE, end - start);
    const unit = src.kind === 'pdf' ? 'page' : 'photo';
    const from = ctx + 1;
    const to = ctx + ownedCount;
    const notes = [
      ctx ? `${unit} 1 is context only` : '',
      to < pages ? `${unit} ${pages} is only there to finish questions that run over` : '',
    ].filter(Boolean);
    const scope = `Extract the questions that start on ${unit}s ${from}–${to} of this excerpt${notes.length ? ` (${notes.join('; ')})` : ''}.`;
    content.push({ type: 'text', text: `${where} ${scope}` });
    const owned = ownedCount;

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

function figureImage(src, q, chunk, start) {
  const f = q.figure;
  try {
    if (f.kind === 'table' && f.html) return renderTable(f.html);
    if (f.kind === 'diagram' && f.svg) return renderSvg(f.svg);
    const page = absPage(chunk, start, f.page || q.page);
    return src.kind === 'pdf' ? cropFromPdf(src.file, page, f.bbox) : cropFromPhoto(src.files[page], f.bbox);
  } catch (err) {
    log.warn(`A figure on page ${absPage(chunk, start, q.page) + 1} couldn't be drawn (${err.message.split('\n')[0]}); that question is marked "needs a human".`);
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
  const open = (year, subject) => papers.push((paper = { year, subject, maxNum: 0, entries: [], keys: new Map() }));
  let prevStart = null;

  for (const start of starts) {
    if (prevStart === null || start !== prevStart + PDF_CHUNK_STRIDE) open(src.year, src.subject);
    prevStart = start;
    const res = chunks[start];
    const passages = new Map(res.passages.map((p) => [p.id, p.text]));

    for (const q of res.questions) {
      const headingChange = q.year != null && q.year !== paper.year;
      const numberingReset = q.number != null && paper.maxNum > 0 && q.number < paper.maxNum - 20;
      // Post-UTME booklets run several subjects back to back, often with the same year heading.
      const subjectChange = !src.subject && paper.subject != null && q.subject !== paper.subject;
      if (paper.entries.length && (headingChange || numberingReset || subjectChange)) {
        // Next subject of the same Post-UTME paper → same year. A numbering reset within one subject is a new
        // paper whose year we can't assume (unless its heading is visible).
        const carriedYear = subjectChange ? paper.year : src.year;
        open(q.year ?? carriedYear, src.subject ?? q.subject);
      } else {
        if (q.year != null) paper.year = q.year;
        paper.subject ??= src.subject ?? q.subject;
      }
      paper.entries.push({ q, start, chunk: res, passages });
      if (q.number != null) paper.maxNum = Math.max(paper.maxNum, q.number);
    }

    // A key block belongs to the most recent paper that's long enough to own it: when paper N's key shares a
    // chunk with the first questions of paper N+1, N+1 is still too short, so the block goes back to N. A
    // printed year narrows the choice but never overrides the size check: two subjects can share a year.
    for (const [kYear, block] of Map.groupBy(res.answerKey, (k) => k.year ?? null)) {
      const maxKey = Math.max(...block.map((k) => k.number));
      let target = null;
      for (let i = papers.length - 1; i >= 0 && !target; i--) {
        const p = papers[i];
        if ((kYear == null || p.year === kYear) && p.maxNum >= maxKey * 0.8) target = p;
      }
      target ??= paper;
      for (const k of block) if (!target.keys.has(k.number)) target.keys.set(k.number, k.answer);
    }
  }
  return papers;
}

function assemble(src) {
  const papers = splitPapers(src, doneChunks(src.key));
  // Drawing figures is slow (one headless Chrome launch or page render each), so show a bar while it runs.
  const figTotal = papers.reduce((s, p) => s + p.entries.filter((e) => e.q.figure).length, 0);
  let figDone = 0;
  const drawFigure = (q, chunk, start) => {
    const img = figureImage(src, q, chunk, start);
    log.progress('🎨 Drawing figures', ++figDone, figTotal, 'a few seconds each');
    return img;
  };
  const rows = loadRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const byScope = new Map(rows.map((r) => [scopeKey(r), r]));
  // Solve may repair a row's text/options, which changes its scopeKey; extractKey is the as-extracted one.
  const byExtract = new Map(rows.filter((r) => r.extractKey).map((r) => [r.extractKey, r]));
  // Page + question number in this source: survives any change to how ids or keys are computed.
  const byRef = new Map(rows.filter((r) => sourceKeyOf(r) === src.key && /-q\d+$/.test(r.sourceRef ?? '')).map((r) => [r.sourceRef, r]));
  let added = 0, refreshed = 0, keysAttached = 0, reopened = 0, figs = 0, flagged = 0, figsRetried = 0;

  /** Re-assembly corrects rows from earlier runs: their year, figure, and keys printed on pages extracted since. */
  const refresh = (row, year, key, entry) => {
    const { q, chunk, start } = entry;
    if (row.needsImage && !row.imageUrl && q.figure && !q.unreadable) {
      // The figure failed to render last time (e.g. Chrome wasn't set up); try again.
      const img = drawFigure(q, chunk, start);
      if (img) Object.assign(row, { imageUrl: img, needsImage: false }), figsRetried++;
    }
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
    for (const entry of paper.entries) {
      const { q, start, chunk, passages } = entry;
      const subject = src.subject ?? q.subject;
      const passage = q.passageId ? passages.get(q.passageId) : null;
      const text = passage ? `PASSAGE:\n${passage}\n\nQUESTION: ${q.text}` : q.text;
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      const key = q.answer ?? (q.number != null ? paper.keys.get(q.number) ?? null : null);
      // Content-based id (stem + options): stable however much of the booklet has been extracted, and two
      // questions sharing a stem ("Which of these is a vector?") with different options stay distinct.
      const id = `p-${src.key}-${shortHash(`${subject}:${looseKey(text)}|${options.map(looseKey).sort().join('|')}`)}`;
      const sourceRef = `${path.basename(src.file ?? src.dir)}#${src.kind === 'pdf' ? 'p' : 'photo'}${absPage(chunk, start, q.page) + 1}${q.number != null ? `-q${q.number}` : ''}`;

      if (byId.has(id)) { refresh(byId.get(id), paper.year, key, entry); continue; }
      const draft = makeRow({
        id, origin: 'pdf', subject, examType: src.examType, school: src.school, year: paper.year, text, options, key, sourceRef,
      });
      draft.extractKey = scopeKey(draft);
      // Earlier runs: the first pilot used year:number ids, and later rows may carry an older extractKey.
      const legacyId = paper.year != null && q.number != null ? `p-${src.key}-${shortHash(`${subject}:${paper.year}:${q.number}`)}` : null;
      const existing =
        byExtract.get(draft.extractKey) ?? (q.number != null && byRef.get(sourceRef)) ??
        (legacyId && byId.get(legacyId)) ?? byScope.get(draft.extractKey);
      if (existing) {
        // Same question already known: an earlier run of this source, or another source.
        if (sourceKeyOf(existing) === src.key) {
          existing.extractKey = draft.extractKey;
          refresh(existing, paper.year, key, entry);
        }
        continue;
      }
      draft.imageUrl = q.figure ? drawFigure(q, chunk, start) : null;
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

  const state = readJson(`extract/${src.key}.json`, { chunks: {} });
  const read = Object.keys(state.chunks).length;
  const name = src.kind === 'pdf' ? `${SUBJECTS[src.subject]} booklet` : `Photos: ${path.basename(src.dir)}`;
  const years = [...new Set(papers.map((p) => p.year).filter(Boolean))].sort();
  const details = [
    added && `${log.fmt.n(added)} new questions`,
    figs && `${figs} figures drawn`,
    flagged && `${flagged} need a human (figure unclear)`,
    keysAttached && `${keysAttached} answers found in the booklet's key`,
    refreshed && `${refreshed} years corrected`,
    figsRetried && `${figsRetried} figures that failed before are now drawn`,
    reopened && `${reopened} answers contradicted by the booklet → Opus will re-check`,
  ].filter(Boolean);
  log.info(
    `📄 ${name.padEnd(36)} ${log.bar(read, state.totalChunks ?? read, 12)} ${read}/${state.totalChunks ?? '?'} parts read` +
      `${years.length ? ` · years ${years[0]}${years.length > 1 ? `–${years.at(-1)}` : ''}` : ''}` +
      `${details.length ? ` · ${details.join(' · ')}` : ''}`,
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

export async function runExtract({ subjects, sourceKeys, limitChunks, pages, budget, shownBudget, dryRun, wait = true }) {
  const sources = allSources().filter((s) =>
    sourceKeys ? sourceKeys.includes(s.key) : subjects ? (s.subject ? subjects.includes(s.subject) : false) : true);
  log.stage('Claude reads the booklets (pages → questions, figures → images)');
  if (sources.length === 0) {
    log.info('No PDF booklets or photo folders for these subjects, so nothing to read.');
    if (!subjects) log.hint('   Photo folders are picked with --source <key>; `status` lists them.');
    return;
  }

  // Ingest anything that finished while we were away before deciding what's left to send.
  await collect(STAGE, ingest, { wait: false, dryRun }); // results that finished while we were away

  const requests = [];
  for (const src of sources) requests.push(...(await buildRequests(src, { limitChunks, pages })));
  const pagesToRead = requests.length * PDF_CHUNK_STRIDE;
  if (requests.length) log.info(`📖 About ${log.fmt.n(pagesToRead)} pages left to read across ${sources.length} booklet(s).`);
  await submit(STAGE, fitBudget(requests, budget, { shownBudget: shownBudget ?? budget }), { dryRun });

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
    log.warn(
      `Couldn't read pages ${contextStart(start) + 1}–${start + PDF_CHUNK_STRIDE + 1} of ${key} (${outcome.error}). ` +
        (f[customId].permanent ? 'Giving up on these pages.' : 'Will retry on the next run.'),
    );
    return;
  }
  const state = readJson(`extract/${key}.json`, { chunks: {} });
  // Page numbers in the result are relative to the first page sent (the context page, when there was one).
  state.chunks[start] = { ...outcome.json, firstPage: contextStart(start) };
  writeJson(`extract/${key}.json`, state);
}
