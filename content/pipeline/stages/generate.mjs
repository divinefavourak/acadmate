// Stage: generate (Sonnet → Opus verifies every one). New practice questions only for JAMB syllabus topics that
// are still thin after the real past questions are in. Tagged AI_ASSISTED with no year: never shown as past papers.
import { EST_OUTPUT_TOKENS, GENERATE_PER_REQUEST, MODELS } from '../config.mjs';
import { collect, estimateCost, fitBudget, inFlight, params, submit } from '../lib/batch.mjs';
import { loadRows, readJson, saveRows, writeJson } from '../lib/state.mjs';
import { LETTERS, looseKey, shortHash } from '../lib/util.mjs';
import { SUBJECTS, TOPICS } from '../syllabus.mjs';
import { makeRow, scopeKey } from './normalize.mjs';

const STAGE = 'generate';
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

const SCHEMA = obj({
  questions: {
    type: 'array',
    items: obj({
      text: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      explanation: { type: 'string' }, // before the letter: fields are written in schema order
      answer: { type: 'string', enum: LETTERS.slice(0, 4) },
      difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
    }),
  },
});

const systemFor = (subject) => `You write original JAMB UTME-standard ${SUBJECTS[subject]} multiple-choice questions for Nigerian candidates, aligned with the current JAMB syllabus.
- Exactly 4 options per question, one unambiguously correct; distractors must be plausible mistakes a candidate would make.
- Match real UTME style, length and difficulty (mix of EASY, MEDIUM, HARD). Text-only: no question may need a figure or table.
- Original wording: never copy or lightly reword the example questions you're shown; cover different facts and skills within the topic.
- explanation: 40–80 words, reasoning first, then why the most tempting wrong option fails. Maths/formulas/units in LaTeX inside $...$.
- Vary which letter is correct.`;

/** Accepted (or pending) JAMB questions per subject → topic. Generated rows count too, so re-runs don't overfill. */
function topicCounts(rows) {
  const counts = new Map();
  for (const r of rows) {
    if (r.examType !== 'JAMB' || r.status === 'discarded' || !r.topic) continue;
    const k = `${r.subject}|${r.topic}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export async function runGenerate({ subjects, minPerTopic = 15, maxRequests, budget, dryRun, wait = true }) {
  await collect(STAGE, ingest, { wait: false });

  const rows = loadRows();
  const counts = topicCounts(rows);
  const plan = readJson('gen.json', { requests: {} });
  const flying = inFlight(STAGE);
  const pendingFor = (subject, topic) =>
    [...flying].filter((id) => plan.requests[id]?.subject === subject && plan.requests[id]?.topic === topic).length * GENERATE_PER_REQUEST;

  const requests = [];
  for (const subject of subjects ?? Object.keys(TOPICS).filter((s) => s !== 'GEN')) {
    for (const topic of TOPICS[subject]) {
      const deficit = Number(minPerTopic) - (counts.get(`${subject}|${topic}`) ?? 0) - pendingFor(subject, topic);
      const examples = rows.filter((r) => r.subject === subject && r.topic === topic && r.status === 'accepted').slice(0, 6);
      for (let made = 0; made < deficit; made += GENERATE_PER_REQUEST) {
        const n = Math.min(GENERATE_PER_REQUEST, deficit - made);
        const id = `g_${shortHash(`${subject}|${topic}|${Object.keys(plan.requests).length + requests.length}`)}`;
        const exampleText = examples.length
          ? `\n\nExisting questions on this topic (for style only; write different ones):\n${examples.map((e, i) => `${i + 1}. ${e.text}`).join('\n')}`
          : '';
        requests.push({
          custom_id: id,
          meta: { subject, topic },
          params: params({
            model: MODELS.worker,
            system: systemFor(subject),
            content: [{ type: 'text', text: `Topic: ${topic}\nWrite ${n} new questions.${exampleText}` }],
            schema: SCHEMA,
            effort: 'medium',
            maxTokens: 16000,
          }),
          estUsd: estimateCost(MODELS.worker, 900, n * EST_OUTPUT_TOKENS.generate),
        });
      }
    }
  }
  const limited = maxRequests ? requests.slice(0, Number(maxRequests)) : requests;
  const fitted = fitBudget(limited, budget);
  if (!dryRun) {
    for (const r of fitted) plan.requests[r.custom_id] = r.meta;
    writeJson('gen.json', plan);
  }
  await submit(STAGE, fitted, { dryRun });
  if (wait && !dryRun) await collect(STAGE, ingest);
}

function ingest(customId, outcome) {
  const meta = readJson('gen.json', { requests: {} }).requests[customId];
  if (!outcome.ok || !meta) {
    console.warn(`  ${customId} failed: ${outcome.error ?? 'unknown request'}`);
    return;
  }
  const rows = loadRows();
  const scopes = new Set(rows.map(scopeKey));
  let added = 0;
  for (const q of outcome.json.questions) {
    const options = q.options.map((o) => o.trim()).filter(Boolean);
    if (options.length !== 4) continue;
    const row = makeRow({
      id: `g-${shortHash(`${meta.subject}:${looseKey(q.text)}`)}`,
      origin: 'gen',
      sourceRef: `generated:${meta.topic}`,
      subject: meta.subject,
      examType: 'JAMB',
      text: q.text.trim(),
      options,
      topic: meta.topic,
      difficulty: q.difficulty,
      sourceType: 'AI_ASSISTED',
      status: 'needs_verify', // every generated question gets the Opus check
      solve: { answer: q.answer, confidence: 'high', explanation: q.explanation },
    });
    const sk = scopeKey(row);
    if (scopes.has(sk)) continue;
    scopes.add(sk);
    rows.push(row);
    added++;
  }
  saveRows(rows);
  console.log(`  ${meta.subject} · ${meta.topic}: +${added} generated (queued for verify)`);
}
