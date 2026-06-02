#!/usr/bin/env node
/**
 * repair-options.js
 * Fills in missing option texts for questions that only have the correct answer.
 *
 * Usage:
 *   node repair-options.js <input.json> <output.json>
 *
 * Reads ANTHROPIC_API_KEY from .env.
 */

const fs        = require('fs');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BATCH_SIZE = 10;  // questions per Claude call
const SLEEP_MS   = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isIncomplete(q) {
  const filled = ['optionA','optionB','optionC','optionD'].filter(o => q[o] && String(q[o]).trim());
  return filled.length < 4;
}

function isRepairable(q) {
  // Need at least the question text. 0-option + no correctOption = unrepairable.
  return q.text && (q.correctOption || ['optionA','optionB','optionC','optionD'].some(o => q[o]));
}

async function repairBatch(anthropic, questions) {
  const payload = questions.map((q, i) => ({
    i,
    subject:  q.subject,
    text:     q.text,
    correctOption: q.correctOption,
    knownOptions: {
      A: q.optionA || null,
      B: q.optionB || null,
      C: q.optionC || null,
      D: q.optionD || null,
    },
  }));

  const prompt = `You are a Nigerian post-UTME exam expert. The following questions were extracted from exam booklets but some answer options are missing (null). Your job is to fill in the missing options with realistic, subject-appropriate distractors.

Rules:
- The correct answer is already given — do NOT change it or move it to a different label
- Generate plausible wrong answers that a student might confuse with the correct one
- Keep the same style and length as the correct option
- Do NOT use LaTeX — plain text only (e.g. "x^2" not "$x^{2}$")
- For questions where ALL options are null and correctOption is also null, return all options as null (cannot repair)

Input:
${JSON.stringify(payload, null, 2)}

Return ONLY a JSON array, same length and index order. Each element:
{ "i": number, "optionA": string|null, "optionB": string|null, "optionC": string|null, "optionD": string|null }`;

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw     = response.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const results = JSON.parse(cleaned);
    if (!Array.isArray(results)) throw new Error('not an array');

    const updated = [...questions];
    for (const r of results) {
      if (typeof r.i !== 'number' || r.i >= updated.length) continue;
      const q = updated[r.i];
      if (r.optionA !== undefined && !q.optionA) updated[r.i] = { ...q, optionA: r.optionA };
      if (r.optionB !== undefined && !q.optionB) updated[r.i] = { ...updated[r.i], optionB: r.optionB };
      if (r.optionC !== undefined && !q.optionC) updated[r.i] = { ...updated[r.i], optionC: r.optionC };
      if (r.optionD !== undefined && !q.optionD) updated[r.i] = { ...updated[r.i], optionD: r.optionD };
    }
    return updated;
  } catch (e) {
    console.warn(`  [parse error] ${e.message} — keeping originals for this batch`);
    return questions;
  }
}

async function main() {
  const [,, inputFile, outputFile] = process.argv;
  if (!inputFile || !outputFile) {
    console.error('Usage: node repair-options.js <input.json> <output.json>');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const all = JSON.parse(fs.readFileSync(inputFile, 'utf8').replace(/^﻿/, ''));
  const bad = all.filter(isIncomplete);
  const unrepairable = bad.filter(q => !isRepairable(q));

  console.log(`\nTotal questions : ${all.length}`);
  console.log(`Incomplete      : ${bad.length}`);
  console.log(`Unrepairable    : ${unrepairable.length} (no text or no answer clue — will be left as-is)`);
  console.log(`To repair       : ${bad.length - unrepairable.length}\n`);

  const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const repairable = bad.filter(isRepairable);

  // Build index map: question id → index in `all`
  const idToIdx = new Map(all.map((q, i) => [q.id ?? i, i]));

  let repaired = 0;
  const totalBatches = Math.ceil(repairable.length / BATCH_SIZE);

  for (let i = 0; i < repairable.length; i += BATCH_SIZE) {
    const batch    = repairable.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} questions) … `);

    const fixed = await repairBatch(anthropic, batch);

    // Patch results back into the full array using index tracking
    fixed.forEach((fixedQ, batchIdx) => {
      const orig    = repairable[i + batchIdx];
      const allIdx  = idToIdx.get(orig.id ?? (i + batchIdx));
      if (allIdx !== undefined) all[allIdx] = fixedQ;
    });

    const nowFixed = fixed.filter(q => !isIncomplete(q)).length;
    repaired += nowFixed;
    console.log(`✓  ${nowFixed}/${batch.length} fully repaired`);

    if (i + BATCH_SIZE < repairable.length) await sleep(SLEEP_MS);
  }

  fs.writeFileSync(outputFile, JSON.stringify(all, null, 2));
  console.log(`\nRepaired ${repaired} questions.`);
  console.log(`Saved → ${outputFile}\n`);
}

main().catch(err => {
  console.error('\nFatal:', err.message ?? err);
  process.exit(1);
});
