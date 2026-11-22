// Stage: verify (Opus). Second opinion only where it's needed: Sonnet disagreed with the booklet key, there is
// no key, or the question is AI-generated. Opus sees the booklet key and Sonnet's answer and rules on both.
import { EST_OUTPUT_TOKENS, KEYLESS_POLICY, MODELS, VERIFY_EFFORT, VERIFY_PER_REQUEST } from '../config.mjs';
import { applyKeylessPolicy } from './solve.mjs';
import { collect, estimateCost, fitBudget, params, submit } from '../lib/batch.mjs';
import { questionBlocks } from '../lib/blocks.mjs';
import { groupId, rememberGroups, rowIdFor, rowsInFlight } from '../lib/groups.mjs';
import * as log from '../lib/log.mjs';
import { loadRows, saveRows } from '../lib/state.mjs';
import { LETTERS, chunk, inExam } from '../lib/util.mjs';
import { SUBJECTS } from '../syllabus.mjs';

const STAGE = 'verify';

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

const SCHEMA = obj({
  results: {
    type: 'array',
    items: obj({
      id: { type: 'string' },
      // Reasoning before the ruling (fields are written in schema order).
      reason: { type: 'string' },
      verdict: { type: 'string', enum: ['keep', 'fix', 'discard'] },
      answer: { type: 'string', enum: LETTERS },
      explanation: nullable({ type: 'string' }),
    }),
  },
});

const systemFor = (subject) => `You are the final answer-key reviewer for a Nigerian JAMB/Post-UTME ${SUBJECTS[subject]} question bank. Wrong answer keys teach students wrong things, so be rigorous: work each question out yourself before weighing the evidence.

Each question shows the booklet's printed answer (often right, but booklets carry typos and wrong keys) and a candidate answer + explanation from another reviewer. The two may disagree, or one may be missing.

For every question return one result with its id:
- reason (write first): your own working in one or two sentences, and what decided it.
- verdict "keep": the candidate answer and explanation are correct. answer = the candidate answer; explanation = null.
- verdict "fix": the correct answer differs from the candidate's, or the candidate's explanation is wrong or misleading. answer = the correct option; explanation = a corrected 40–80 word explanation in the same style (reasoning first, why the tempting wrong option fails, LaTeX in $...$).
- verdict "discard": no option is correct, more than one is defensibly correct, the question is ambiguous or garbled, or it depends on information that isn't given.`;

export async function runVerify({ exam, subjects, origin, limit, budget, dryRun, effort = VERIFY_EFFORT, wait = true, keyless = KEYLESS_POLICY }) {
  log.stage('Opus double-checks disagreements and questions with no printed answer');
  await collect(STAGE, ingest, { wait: false, dryRun }); // results that finished while we were away

  // Keyless rows the policy lets Sonnet answer never need Opus; settle them before building requests.
  const current = loadRows();
  const settled = applyKeylessPolicy(current, keyless);
  if (settled) {
    if (!dryRun) saveRows(current);
    log.info(keyless === 'opus'
      ? `↩️  ${settled} answers that only Sonnet had checked go to Opus too.`
      : `✔ Accepted Sonnet's answer on ${settled} questions with no printed answer (--keyless ${keyless}).`);
  }

  const flying = rowsInFlight(STAGE);
  const rows = loadRows().filter((r) =>
    r.status === 'needs_verify' && inExam(r, exam) && !flying.has(r.id) &&
    (!subjects || subjects.includes(r.subject)) && (!origin || r.origin === origin));
  const picked = limit ? rows.slice(0, Number(limit)) : rows;
  if (picked.length) log.info(`⚖  ${log.fmt.n(picked.length)} questions for Opus to check.`);

  const requests = [];
  for (const [subject, group] of Map.groupBy(picked, (r) => r.subject)) {
    for (const part of chunk(group, VERIFY_PER_REQUEST)) {
      const content = questionBlocks(part, (r) =>
        `\n\nBooklet answer: ${r.key ?? 'none printed'}\nCandidate answer: ${r.solve.answer}\nCandidate explanation: ${r.solve.explanation}`);
      const inputChars = content.reduce((s, b) => s + (b.text?.length ?? 0), 0);
      const images = content.filter((b) => b.type === 'image').length;
      requests.push({
        custom_id: groupId('v', part),
        rowIds: part.map((r) => r.id),
        params: params({ model: MODELS.judge, system: systemFor(subject), content, schema: SCHEMA, effort, maxTokens: 32000 }),
        estUsd: estimateCost(MODELS.judge, 700 + inputChars / 3.5 + images * 1200, part.length * EST_OUTPUT_TOKENS.verify),
      });
    }
  }
  const fitted = fitBudget(requests, budget);
  rememberGroups(fitted);
  await submit(STAGE, fitted, { dryRun });
  if (wait && !dryRun) await collect(STAGE, ingest);

  const checked = tally.confirmed + tally.answerFixed + tally.explanationFixed + tally.rejected;
  if (checked) {
    log.ok(
      `Opus checked ${log.fmt.n(checked)} questions:  ${log.fmt.n(tally.confirmed)} confirmed ✔ · ` +
        `${log.fmt.n(tally.answerFixed)} answer corrected 🔁 · ${log.fmt.n(tally.explanationFixed)} explanation rewritten ✏️ · ` +
        `${log.fmt.n(tally.rejected)} rejected ✖`,
    );
    log.hint('   (🔁 = Sonnet picked the wrong option.  ✏️ = right answer, but the explanation was weak or wrong.  ✖ = no option is right, or the question is ambiguous.)');
  }
  if (tally.failed) log.warn(`${log.fmt.n(tally.failed)} checks didn't come back; they'll be retried on the next run.`);
  Object.assign(tally, { confirmed: 0, answerFixed: 0, explanationFixed: 0, rejected: 0, failed: 0 });
}

// What Opus decided in this run, for the summary line.
const tally = { confirmed: 0, answerFixed: 0, explanationFixed: 0, rejected: 0, failed: 0 };

function ingest(customId, outcome) {
  if (!outcome.ok) {
    tally.failed++;
    return;
  }
  const rows = loadRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const res of outcome.json.results) {
    const row = byId.get(rowIdFor(customId, res.id));
    if (!row || row.status !== 'needs_verify') continue;
    row.verify = { verdict: res.verdict, answer: res.answer, reason: res.reason };

    if (res.verdict === 'discard' || LETTERS.indexOf(res.answer) >= row.options.length) {
      row.status = 'discarded';
      row.discardReason = `verify: ${res.reason}`;
      tally.rejected++;
      continue;
    }
    if (res.answer !== row.solve.answer) tally.answerFixed++;
    else if (res.verdict === 'fix') tally.explanationFixed++;
    else tally.confirmed++;
    row.answer = res.answer;
    // A changed answer needs a matching explanation; Sonnet's would argue for the wrong option.
    row.explanation = res.explanation ?? (res.answer === row.solve.answer ? row.solve.explanation : null);
    row.status = 'accepted';
  }
  saveRows(rows);
}
