/**
 * fix_questions.mjs
 * Validates and fixes jamb_mathematics.json:
 *  - Wraps math in proper $...$ / $$...$$ LaTeX delimiters
 *  - Solves for correctOption where missing/blank
 *  - Fixes garbled text/options from bad PDF extraction
 *  - Diagram questions: format-only, correctOption preserved as-is
 *
 * Usage:  node fix_questions.mjs
 * Resume: re-run — it reads progress from fix_progress.json and skips done batches
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";

config();

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error("GEMINI_API_KEY not found in .env"); process.exit(1); }

const genai = new GoogleGenerativeAI(GEMINI_KEY);
const model = genai.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
});

const INPUT_FILE  = "jamb_mathematics.json";
const OUTPUT_FILE = "jamb_mathematics_fixed.json";
const PROGRESS_FILE = "fix_progress.json";
const BATCH_SIZE = 10;

// ─── Load data ────────────────────────────────────────────────────────────────

const raw = JSON.parse(readFileSync(INPUT_FILE, "utf8"));
console.log(`Loaded ${raw.length} questions from ${INPUT_FILE}`);

// ─── Load / init progress ─────────────────────────────────────────────────────

let progress = { done: [], results: [] };
if (existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  console.log(`Resuming — ${progress.results.length} questions already fixed`);
}

const doneBatches = new Set(progress.done);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function isDiagramQuestion(q) {
  const all = [q.text, q.optionA, q.optionB, q.optionC, q.optionD].join(" ").toLowerCase();
  return /\b(diagram|figure|fig\.|picture|image|table above|chart|graph above|shown above|given (below|above)|in the (figure|diagram)|refer to)\b/.test(all);
}

const SYSTEM_PROMPT = `You are a JAMB mathematics expert. You will receive a batch of multiple-choice questions extracted from past JAMB papers. Each question may have:
- Math expressions NOT wrapped in LaTeX delimiters (e.g. x^2, frac{a}{b})
- A missing or empty correctOption
- Garbled text from bad PDF extraction

Your job for each question:
1. FIX the text, optionA/B/C/D, explanation — wrap ALL mathematical expressions in $...$ (inline) or $$...$$ (display). Examples:
   - "x^2 + 3x" → "$x^2 + 3x$"
   - "81a^4 - 16b^4" → "$81a^4 - 16b^4$"
   - "\\frac{3}{4}" → "$\\frac{3}{4}$"
   - "3a^2" → "$3a^2$"
   - Plain text like "Find the perimeter" stays as-is
2. SOLVE the question: determine which of the four options (A, B, C, or D) is mathematically correct. Set correctOption to that letter.
3. If the question is marked isDiagram=true, do NOT try to solve it — just fix the LaTeX formatting and return correctOption as the original value (or empty string if it was empty).
4. Fix obviously garbled options (e.g. "18ccm" → "18cm", "9a^\\frac{2}{2}" → "$\\frac{9a^2}{2}$").
5. Write a clear 1-sentence explanation if one is missing or wrong.

Return a JSON array of exactly the same length as the input, each object having:
{
  "subject": string,
  "topic": string,
  "text": string,          // fixed
  "optionA": string,       // fixed
  "optionB": string,       // fixed
  "optionC": string,       // fixed
  "optionD": string,       // fixed
  "correctOption": string, // "A","B","C","D" — uppercase letter only
  "year": number or null,
  "difficulty": string,
  "explanation": string    // fixed
}

IMPORTANT: Return ONLY the JSON array, nothing else.`;

async function fixBatch(batch, batchIdx) {
  const payload = batch.map((q, i) => ({
    index: i,
    isDiagram: isDiagramQuestion(q),
    subject: q.subject,
    topic: q.topic,
    text: q.text,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctOption: q.correctOption,
    year: q.year,
    difficulty: q.difficulty,
    explanation: q.explanation,
  }));

  const prompt = `${SYSTEM_PROMPT}\n\nBatch ${batchIdx}:\n${JSON.stringify(payload, null, 2)}`;

  let attempts = 0;
  while (attempts < 4) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const fixed = JSON.parse(text);
      if (!Array.isArray(fixed) || fixed.length !== batch.length) {
        throw new Error(`Expected array of ${batch.length}, got ${Array.isArray(fixed) ? fixed.length : typeof fixed}`);
      }
      return fixed;
    } catch (err) {
      attempts++;
      console.warn(`  Batch ${batchIdx} attempt ${attempts} failed: ${err.message}`);
      if (attempts < 4) await new Promise(r => setTimeout(r, 3000 * attempts));
    }
  }
  // If all attempts fail, return the originals unchanged
  console.error(`  Batch ${batchIdx} FAILED after 4 attempts — keeping originals`);
  return batch;
}

// ─── Main loop ────────────────────────────────────────────────────────────────

const totalBatches = Math.ceil(raw.length / BATCH_SIZE);
let processed = progress.results.length;

for (let b = 0; b < totalBatches; b++) {
  if (doneBatches.has(b)) {
    process.stdout.write(`Batch ${b + 1}/${totalBatches} — already done\r`);
    continue;
  }

  const batch = raw.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
  const diagCount = batch.filter(isDiagramQuestion).length;
  console.log(`\nBatch ${b + 1}/${totalBatches} (${batch.length} Qs, ${diagCount} diagrams)…`);

  const fixed = await fixBatch(batch, b);

  progress.results.push(...fixed);
  progress.done.push(b);
  processed += fixed.length;
  saveProgress();

  console.log(`  ✓ Batch ${b + 1} done — ${processed}/${raw.length} total`);

  // Respect Gemini rate limits (15 req/min on free tier)
  if (b < totalBatches - 1) await new Promise(r => setTimeout(r, 4500));
}

// ─── Write output ─────────────────────────────────────────────────────────────

writeFileSync(OUTPUT_FILE, JSON.stringify(progress.results, null, 2));
console.log(`\n✅ Done! Wrote ${progress.results.length} fixed questions to ${OUTPUT_FILE}`);

// Stats
const withAnswer = progress.results.filter(q => q.correctOption && ["A","B","C","D"].includes(q.correctOption.toUpperCase())).length;
const diagSkipped = progress.results.filter(q => isDiagramQuestion(q)).length;
console.log(`   Valid correctOption: ${withAnswer}/${progress.results.length}`);
console.log(`   Diagram questions:   ${diagSkipped}`);
