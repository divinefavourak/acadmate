// Stage: solve+explain (Sonnet). Claude answers each question WITHOUT seeing the booklet key, writes an original
// explanation, assigns topic + difficulty and repairs transcription noise. Agreement with the key is the cheap
// check: agreeing rows are accepted; disagreeing or keyless rows go to the Opus verifier.
import { EST_OUTPUT_TOKENS, KEYLESS_POLICY, MODELS, SOLVE_EFFORT_MEDIUM, SOLVE_PER_REQUEST } from '../config.mjs';
import { collect, estimateCost, fitBudget, params, submit } from '../lib/batch.mjs';
import { questionBlocks } from '../lib/blocks.mjs';
import { groupId, groupRows, rememberGroups, rowIdFor, rowsInFlight } from '../lib/groups.mjs';
import { loadRows, saveRows } from '../lib/state.mjs';
import { LETTERS, chunk } from '../lib/util.mjs';
import { SUBJECTS, TOPICS } from '../syllabus.mjs';
import { sourceComplete, sourceKeyOf } from './extract.mjs';

const STAGE = 'solve';

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

const schemaFor = (subject) => obj({
  results: {
    type: 'array',
    items: obj({
      id: { type: 'string' },
      quality: { type: 'string', enum: ['ok', 'fixed', 'broken'] },
      brokenReason: nullable({ type: 'string' }),
      text: nullable({ type: 'string' }),
      options: nullable({ type: 'array', items: { type: 'string' } }),
      // Order matters: the model writes fields in schema order, so the working (explanation) must come before
      // the letter. With answer first, the pilot picked letters that contradicted its own correct working.
      explanation: { type: 'string' },
      answer: { type: 'string', enum: LETTERS },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      topic: { type: 'string', enum: TOPICS[subject] },
      difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
    }),
  },
});

const systemFor = (subject) => `You are an experienced Nigerian secondary-school ${SUBJECTS[subject]} teacher preparing questions for a JAMB/Post-UTME CBT practice website. You are not shown any answer key: work each question out yourself.

For every question (q1, q2, …) return one result with its id:
- explanation (write this BEFORE choosing the letter): 40–80 words, in your own words for a UTME candidate. Work the question out — show the key reasoning or calculation — then say in one short clause why the most tempting wrong option fails. Start with the reasoning itself, never "Option B is correct because…". Maths, formulas and units in LaTeX inside $...$.
- answer: the letter of the option your explanation arrives at. Re-read the options and match your result to its letter; the letter must agree with your working. confidence: how sure you are.
- topic: the closest topic from the allowed list. difficulty: for a typical UTME candidate.
- quality:
  "ok" — the question is clean.
  "fixed" — you repaired obvious transcription errors (typos, OCR noise, broken LaTeX, options run together). Return the corrected text and/or options (same number of options, same order); leave the other null. Never change the meaning or which option is correct.
  "broken" — unusable: options missing or garbled beyond repair, needs a figure that isn't provided, no option is correct, or not a real question. Give brokenReason.
- text and options are null unless quality is "fixed".`;

export async function runSolve({ subjects, origin, limit, budget, dryRun, wait = true, allowPartial = false, keyless = KEYLESS_POLICY }) {
  ingestPolicy = keyless;
  await collect(STAGE, ingest, { wait: false });

  const flying = rowsInFlight(STAGE);
  const complete = new Map();
  const ready = (r) => {
    // A PDF's answer keys usually sit at the end of each section. Solving before they're extracted sends the
    // row to Opus for lack of a key (the costly path), so wait for the whole source unless told otherwise.
    const key = sourceKeyOf(r);
    if (!key || allowPartial) return true;
    if (!complete.has(key)) complete.set(key, sourceComplete(key));
    return complete.get(key);
  };
  const candidates = loadRows().filter((r) =>
    r.status === 'new' && !r.needsImage && !flying.has(r.id) &&
    (!subjects || subjects.includes(r.subject)) && (!origin || r.origin === origin));
  const rows = candidates.filter(ready);
  const waiting = [...complete].filter(([, done]) => !done).map(([k]) => k);
  if (waiting.length) {
    console.log(`holding ${candidates.length - rows.length} rows until extraction finishes for: ${waiting.join(', ')} (--allow-partial to solve now)`);
  }
  const picked = limit ? rows.slice(0, Number(limit)) : rows;

  const bySubject = Map.groupBy(picked, (r) => r.subject);
  const requests = [];
  for (const [subject, group] of bySubject) {
    for (const part of chunk(group, SOLVE_PER_REQUEST)) {
      const content = questionBlocks(part);
      const inputChars = content.reduce((s, b) => s + (b.text?.length ?? 0), 0);
      const images = content.filter((b) => b.type === 'image').length;
      requests.push({
        custom_id: groupId('s', part),
        rowIds: part.map((r) => r.id),
        params: params({
          model: MODELS.worker, system: systemFor(subject), content, schema: schemaFor(subject),
          effort: SOLVE_EFFORT_MEDIUM.has(subject) ? 'medium' : 'low', maxTokens: 32000,
        }),
        estUsd: estimateCost(MODELS.worker, 900 + inputChars / 3.5 + images * 1200, part.length * EST_OUTPUT_TOKENS.solve),
      });
    }
  }
  const fitted = fitBudget(requests, budget);
  rememberGroups(fitted);
  await submit(STAGE, fitted, { dryRun });
  if (wait && !dryRun) await collect(STAGE, ingest);
  summarize();
}

function ingest(customId, outcome) {
  const ids = groupRows(customId);
  if (!outcome.ok) {
    console.warn(`  ${customId} (${ids.length} rows) failed: ${outcome.error} — rows stay "new" and are retried next run`);
    return;
  }
  const rows = loadRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const res of outcome.json.results) {
    const row = byId.get(rowIdFor(customId, res.id));
    if (!row || row.status !== 'new') continue;

    if (res.quality === 'broken') {
      row.status = 'discarded';
      row.discardReason = `solve: ${res.brokenReason ?? 'broken'}`;
      continue;
    }
    if (res.quality === 'fixed') {
      if (res.text) row.text = res.text;
      if (res.options?.length === row.options.length) row.options = res.options;
    }
    if (LETTERS.indexOf(res.answer) >= row.options.length) {
      row.status = 'discarded';
      row.discardReason = `solve: answer ${res.answer} is not one of the ${row.options.length} options`;
      continue;
    }
    row.solve = { answer: res.answer, confidence: res.confidence, explanation: res.explanation };
    row.topic = res.topic;
    row.difficulty = res.difficulty;
    // Booklet + Claude agree → accept. They disagree → Opus. No booklet answer → per keyless policy.
    row.status = row.key && row.key === res.answer ? 'accepted' : 'needs_verify';
    if (row.status === 'accepted') {
      row.answer = row.key;
      row.explanation = res.explanation;
    }
  }
  applyKeylessPolicy(rows, ingestPolicy);
  saveRows(rows);
}

let ingestPolicy = KEYLESS_POLICY;

/**
 * Rows with no booklet answer, waiting for Opus only because there was nothing to compare with: accept Sonnet's
 * answer when the policy allows. Generated questions and booklet/Sonnet disagreements always stay with Opus.
 * Runs on ingest and at the start of solve/verify, so changing the policy also applies to rows already queued.
 */
export function applyKeylessPolicy(rows, policy = KEYLESS_POLICY) {
  if (!['sonnet-unless-low', 'sonnet', 'opus'].includes(policy)) {
    throw new Error(`--keyless must be sonnet-unless-low, sonnet or opus (got "${policy}")`);
  }
  if (policy === 'opus') {
    // Switching to the strict policy: answers Sonnet gave alone go back for an Opus check.
    let reopened = 0;
    for (const r of rows) {
      if (r.status === 'accepted' && r.answeredBy === 'sonnet') {
        Object.assign(r, { status: 'needs_verify', answer: null, answeredBy: null });
        reopened++;
      }
    }
    return reopened;
  }
  let accepted = 0;
  for (const r of rows) {
    if (r.status !== 'needs_verify' || r.key || r.origin === 'gen' || r.verify || !r.solve) continue;
    if (policy === 'sonnet-unless-low' && r.solve.confidence === 'low') continue;
    r.status = 'accepted';
    r.answer = r.solve.answer;
    r.explanation = r.solve.explanation;
    r.answeredBy = 'sonnet'; // no booklet key and no Opus check: worth knowing when students flag one
    accepted++;
  }
  return accepted;
}

function summarize() {
  const rows = loadRows();
  const count = (s) => rows.filter((r) => r.status === s).length;
  console.log(`rows: ${count('new')} new · ${count('needs_verify')} need verify · ${count('accepted')} accepted · ${count('discarded')} discarded`);
}
