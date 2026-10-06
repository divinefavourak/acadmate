/**
 * correct-flagged.mjs
 * Corrects questions using an LLM. Picks a primary provider by preference
 * (Gemini → Groq → Anthropic → OpenRouter) and automatically falls back to
 * OpenRouter when the primary hits a rate / daily-quota limit.
 * Processes in batches. Safe to re-run; already-processed entries are skipped.
 *
 * Usage:
 *   node question-bank/correct-flagged.mjs                        # flagged-questions.json
 *   node question-bank/correct-flagged.mjs invalid-questions.json # custom file
 *
 * Set keys in acadmate-api/.env (or environment):
 *   GEMINI_API_KEY=...      ← preferred primary (1500 req/day, 1M TPM free)
 *   OPENROUTER_API_KEY=...  ← used as automatic fallback on rate limit
 *   GROQ_API_KEY=...        ← optional
 *   ANTHROPIC_API_KEY=...   ← optional
 */

import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

const FILE = process.argv[2] ?? fileURLToPath(new URL('flagged-questions.json', import.meta.url));

// ── env ────────────────────────────────────────────────────────────────────────
function loadEnv(path) {
  try {
    const vars = {};
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0 && !line.startsWith('#')) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        vars[key] = val;
      }
    }
    return vars;
  } catch { return {}; }
}

const env = loadEnv(new URL('../acadmate-api/.env', import.meta.url));

const GEMINI_KEY     = process.env.GEMINI_API_KEY     || env.GEMINI_API_KEY;
const GROQ_KEY       = process.env.GROQ_API_KEY       || env.GROQ_API_KEY;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY  || env.ANTHROPIC_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;

// Provider definitions — { name, key, model }
const PROVIDERS = {
  gemini:     GEMINI_KEY     && { name: 'gemini',     key: GEMINI_KEY,     model: 'gemini-2.5-flash' },
  groq:       GROQ_KEY       && { name: 'groq',       key: GROQ_KEY,       model: 'llama-3.3-70b-versatile' },
  anthropic:  ANTHROPIC_KEY  && { name: 'anthropic',  key: ANTHROPIC_KEY,  model: 'claude-haiku-4-5-20251001' },
  openrouter: OPENROUTER_KEY && { name: 'openrouter', key: OPENROUTER_KEY, model: 'meta-llama/llama-3.3-70b-instruct:free' },
};

// Primary = first available in preference order; OpenRouter is the fallback when primary rate-limits.
const PRIMARY  = PROVIDERS.gemini || PROVIDERS.groq || PROVIDERS.anthropic || PROVIDERS.openrouter;
const FALLBACK = OPENROUTER_KEY && PRIMARY?.name !== 'openrouter' ? PROVIDERS.openrouter : null;

if (!PRIMARY) {
  console.error('ERROR: Set GEMINI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY in acadmate-api/.env');
  process.exit(1);
}

const BATCH_SIZE = PRIMARY.name === 'gemini' ? 10 : 5;
const DELAY_MS   = PRIMARY.name === 'gemini' ? 4500 : PRIMARY.name === 'groq' ? 32000 : 500;

console.log(`Primary: ${PRIMARY.name} (${PRIMARY.model})  Batch: ${BATCH_SIZE}`);
console.log(`Fallback: ${FALLBACK ? `${FALLBACK.name} (${FALLBACK.model})` : 'none'}`);

// ── system prompt ──────────────────────────────────────────────────────────────
const SYSTEM = `You are an expert in Nigerian JAMB/UTME and Post-UTME exam questions covering Biology, Economics, Literature in English, Mathematics, and Use of English. You correct questions that were extracted from PDFs via OCR and may have errors.

You receive a JSON array of questions. Return ONLY a raw JSON array (no markdown, no code fences) with one object per input question in the same order. Each object:
  id: string            (copy from input exactly)
  action: "delete" | "fix" | "keep"
  correctedText: string | null
  correctedOptions: [{id, label, text, isCorrect}] | null
  correctedExplanation: string | null

═══ WHEN TO DELETE ═══
• "Question Paper Type" meta-question ("Which paper type A/B/C/D is given to you?")
• Requires a missing diagram AND options are only Roman numerals I/II/III/IV
• Question text is a worked solution with answer prefix (e.g. "89. C To simplify…")
• Unrepairable / completely unintelligible

═══ WHEN TO FIX ═══
Always provide correctedText + correctedOptions. Apply all fixes that apply:

OCR CLEANUP — fix garbled words:
  pr.oduced→produced, abundancye→abundance, responsibmle→responsible,
  representwed→represented, animaols→animals, fo c llowing→following,
  t -saving→cost-saving, s called→called, Utilitys→Utility,
  iwssue→issue, teirms→terms, balasnce→balance, odetermined→determined,
  initernal→internal, piroduction→production
  Remove stray single characters (w, y, o, g, l) floating mid-sentence or at end of text.

OPTION CONTAMINATION — strip next-question text appended to any option:
  "Use the diagram below to answer questions…", "This question is based on…",
  "Questions X to Y are based on…", "OMICS QUESTIONS", "LOGY QUESTIONS",
  "IN-ENGLISH QUESTIONS", "m o c . t s i g l o", "BIOLOGY QUESTIONS"

MERGED OPTION LABELS — split label letters fused into text:
  "Bg. distribution" → B text = "distribution"
  "initernal economies Bg. diseconomies" → A="internal economies of scale", B="diseconomies of large scale"
  "IwV"→"IV",  "III wD. II"→C text="III", D text="II"

MERGED QUESTIONS (8 options with two sets of A/B/C/D) — keep ONLY the first 4 options with original IDs. Set correctedText to the first question only.

EMPTY OPTION TEXT — fill in the correct JAMB distractor using your knowledge of the subject, question, and what the other options are. Never leave any option with empty text.

MISSING OPTIONS (fewer than 4) — add the standard JAMB distractors using subject knowledge. Use id format: "generated_<LABEL>_<last6ofQuestionId>"

NO CORRECT ANSWER — use your knowledge of the subject, year, and question to mark the factually correct option isCorrect:true and all others false. This is the most common issue — always fix it.

RECONSTRUCT QUESTION TEXT — if question text is garbled but options are clear, reconstruct the question from the options and subject/year context.

═══ WHEN TO KEEP ═══
Question and all options are already correct — just clear the flag. Set all corrected fields to null.

═══ HARD RULES ═══
1. Output array length MUST equal input array length, in same order
2. Every "id" in output must exactly match the input question's id
3. Every option in correctedOptions must have non-empty text
4. Exactly ONE option must have isCorrect:true per question
5. Preserve original option IDs exactly (only use generated_ prefix for brand-new options)`;

// ── countdown timer ────────────────────────────────────────────────────────────
async function countdown(ms) {
  const secs = Math.ceil(ms / 1000);
  for (let s = secs; s > 0; s--) {
    process.stdout.write(`\r  next batch in ${String(s).padStart(2)}s ...`);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.stdout.write('\r' + ' '.repeat(30) + '\r');
}

// ── rate-limit-aware fetch ─────────────────────────────────────────────────────
async function fetchWithRetry(url, opts, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, opts);
    const data = await res.json();
    if (res.ok) return data;

    const msg = data.error?.message ?? JSON.stringify(data);
    if (res.status === 429) {
      // Parse the retry hint — handles "2.78s", "1m30s", "2h33m" formats
      let waitSec = 15;
      const h = msg.match(/([\d.]+)\s*h/i);
      const m = msg.match(/([\d.]+)\s*m(?!s)/i);
      const s = msg.match(/([\d.]+)\s*s/i);
      if (h || m || s) {
        waitSec = Math.ceil((h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0)) + 1;
      }
      // A multi-minute wait means a DAILY cap was hit — surface as rate-limit so caller can fall back
      if (waitSec > 180) {
        const e = new Error(`Daily quota hit (retry in ~${Math.round(waitSec / 60)}min)`);
        e.rateLimited = true;
        throw e;
      }
      process.stdout.write(`rate-limit, waiting ${waitSec}s... `);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }

    // 5xx / "overloaded" / "high demand" — transient; back off and retry, then fall back
    if (res.status >= 500 || /high demand|overloaded|unavailable|try again later/i.test(msg)) {
      if (attempt < maxRetries) {
        const waitSec = Math.min(2 ** attempt * 3, 30); // 3, 6, 12, 24...
        process.stdout.write(`overloaded, waiting ${waitSec}s... `);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      const e = new Error('Provider overloaded (5xx) after retries');
      e.rateLimited = true; // reuse the fallback path
      throw e;
    }

    throw new Error(msg);
  }
  const e = new Error('Max retries exceeded (rate limit)');
  e.rateLimited = true;
  throw e;
}

// ── per-provider call (returns raw text) ─────────────────────────────────────────
async function callProvider(provider, payload) {
  const { name, key, model } = provider;

  if (name === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const data = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }, // 2.5-flash thinks by default, eating the output budget
        },
      }),
    });
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  if (name === 'groq' || name === 'openrouter') {
    const url = name === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';
    const data = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model, max_tokens: 4096, temperature: 0,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(payload) }],
      }),
    });
    return data.choices[0].message.content;
  }

  // anthropic
  const data = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4096, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(payload) }] }),
  });
  return data.content[0].text;
}

// ── API call with fallback ───────────────────────────────────────────────────────
async function correctBatch(batch) {
  const payload = batch.map(q => ({
    id:          q.id,
    subject:     q.subject,
    year:        q.year,
    issues:      q.issues ?? [],
    text:        q.text,
    options:     q.options,
    explanation: q.explanation,
  }));

  let text;
  try {
    text = await callProvider(PRIMARY, payload);
  } catch (err) {
    if (err.rateLimited && FALLBACK) {
      process.stdout.write(`→ ${PRIMARY.name} rate-limited, falling back to ${FALLBACK.name}... `);
      text = await callProvider(FALLBACK, payload);
    } else {
      throw err;
    }
  }

  const start = text.indexOf('['), end = text.lastIndexOf(']');
  if (start === -1 || end === -1) {
    const e = new Error(`No JSON array in response`);
    e.parseError = true;
    throw e;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    const e = new Error(`Malformed JSON (likely truncated)`);
    e.parseError = true;
    throw e;
  }
}

// ── validation ─────────────────────────────────────────────────────────────────
function validateOne(q, r) {
  if (!r.id || r.id !== q.id) throw new Error(`ID mismatch: got ${r.id}`);
  if (!['delete', 'fix', 'keep'].includes(r.action)) throw new Error(`Invalid action: ${r.action}`);
  if (r.correctedOptions) {
    const origIds = new Set(q.options.map(o => o.id));
    for (const opt of r.correctedOptions) {
      if (!origIds.has(opt.id) && !opt.id?.startsWith('generated_')) throw new Error(`Unknown ID: ${opt.id}`);
      if (!opt.text?.trim()) throw new Error(`Empty text on option ${opt.label}`);
    }
    const correct = r.correctedOptions.filter(o => o.isCorrect).length;
    if (correct !== 1) throw new Error(`Expected 1 correct option, got ${correct}`);
  }
}

// ── main ───────────────────────────────────────────────────────────────────────
const questions = JSON.parse(readFileSync(FILE, 'utf-8'));
const pending = questions.filter(q => q.action === 'keep' && q.correctedText === null && q.correctedOptions === null);
const alreadyDone = questions.length - pending.length;

const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
const estMins = Math.ceil((totalBatches * DELAY_MS) / 60000);

console.log(`Total: ${questions.length}  |  Done: ${alreadyDone}  |  Pending: ${pending.length}`);
console.log(`Batches: ${totalBatches}  |  Est. time: ~${estMins} min\n`);

const byId = Object.fromEntries(questions.map(q => [q.id, q]));
let processed = 0, errors = 0;

// Apply a model result to a question; returns its action or null on validation failure.
function applyResult(q, r) {
  try {
    validateOne(q, r);
    const target = byId[q.id];
    target.action               = r.action;
    target.correctedText        = r.correctedText        ?? null;
    target.correctedOptions     = r.correctedOptions     ?? null;
    target.correctedExplanation = r.correctedExplanation ?? null;
    return r.action;
  } catch {
    return null;
  }
}

// Process one batch; on a parse error (truncated JSON), split and retry the halves.
async function runBatch(batch, summary) {
  let results;
  try {
    results = await correctBatch(batch);
    if (results.length !== batch.length) { const e = new Error('length mismatch'); e.parseError = true; throw e; }
  } catch (err) {
    if (err.parseError && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      await runBatch(batch.slice(0, mid), summary);
      await new Promise(r => setTimeout(r, 800));
      await runBatch(batch.slice(mid), summary);
      return;
    }
    summary.err += batch.length;
    errors += batch.length;
    process.stdout.write(`[err: ${err.message}] `);
    return;
  }

  for (let j = 0; j < batch.length; j++) {
    const action = applyResult(batch[j], results[j]);
    if (action) { summary[action]++; processed++; }
    else        { summary.err++;    errors++; }
  }
}

for (let i = 0; i < pending.length; i += BATCH_SIZE) {
  const batch = pending.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;

  process.stdout.write(`[${batchNum}/${totalBatches}] q${i + 1}–${Math.min(i + BATCH_SIZE, pending.length)} ... `);

  const summary = { fix: 0, delete: 0, keep: 0, err: 0 };
  await runBatch(batch, summary);

  const line = Object.entries(summary).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(' ') || 'done';
  process.stdout.write(line + '\n');
  writeFileSync(FILE, JSON.stringify(questions, null, 2));

  if (i + BATCH_SIZE < pending.length) await countdown(DELAY_MS);
}

console.log(`\nDone. processed=${processed}  errors=${errors}`);
console.log(`Next: node question-bank/seed-corrected.mjs ${FILE}`);
