#!/usr/bin/env node
/**
 * extract-questions.js
 * Extracts Post-UTME exam questions from booklet photos using Gemini Vision,
 * then corrects and verifies answers with Claude.
 *
 * Usage:
 *   node extract-questions.js <photos-folder> <output.json> [year]
 *   node extract-questions.js <output.json> --correct-only
 *
 * Env:
 *   GEMINI_API_KEY    — required (vision extraction)
 *   ANTHROPIC_API_KEY — required (correction pass)
 *
 * Install once:
 *   npm install @google/generative-ai @anthropic-ai/sdk
 */

const fs        = require('fs');
const path      = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

// ── Config ────────────────────────────────────────────────────────────────────
const VISION_MODEL      = 'gemini-2.5-flash';          // Google Gemini — vision
const CORRECTION_MODEL  = 'claude-haiku-4-5-20251001'; // Anthropic — correction
const VERIFY_BATCH  = 20;
const REQUEST_DELAY = 3000;    // ms between vision calls
const MAX_RETRIES   = 8;       // retries before giving up
const RETRY_BASE_MS = 15000;   // exponential base: 15s, 30s, 60s, 120s …

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// ── Helpers ───────────────────────────────────────────────────────────────────
function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function imageToBase64(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg'  ? 'image/jpeg'
             : ext === 'jpeg' ? 'image/jpeg'
             : ext === 'png'  ? 'image/png'
             : ext === 'webp' ? 'image/webp'
             : ext === 'gif'  ? 'image/gif'
             : 'image/jpeg';
  return { base64: buf.toString('base64'), mime };
}

function needsImageFlag(text) {
  return /\b(diagram|figure|fig\.|graph|chart|table|image|illustration|below|above|shown)\b/i.test(text);
}

// Repair invalid JSON escape sequences produced by LLM LaTeX output (e.g. \{ \} \^ \_ \frac)
function sanitizeJson(str) {
  // Replace \X where X is not a valid JSON escape char with just X
  return str.replace(/\\([^"\\/bfnrtu0-9])/g, (_, c) => c);
}

// fn(model) must return a Promise. Tries each model up to MAX_RETRIES times before moving on.
async function callWithRetry(fn, label, models) {
  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn(model);
      } catch (err) {
        const status  = err?.status ?? err?.response?.status;
        const errCode = err?.error?.code ?? '';
        const errMsg  = String(err?.message ?? '');
        const isRateLimit = status === 429 || status === 503 ||
          errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
        const isModelUnavailable = status === 404 ||
          (status === 400 && (
            errCode === 'model_not_found' || errCode === 'model_decommissioned' ||
            errMsg.includes('model_decommissioned') || errMsg.includes('does not exist')
          ));

        if (isModelUnavailable) {
          // Hard skip — no point retrying a missing/decommissioned model
          if (m < models.length - 1) {
            console.warn(`  [model unavailable] ${model} — switching to ${models[m + 1]}`);
          }
          break;
        } else if (isRateLimit) {
          if (attempt === MAX_RETRIES) {
            if (m < models.length - 1) {
              console.warn(`  [rate-limit] ${label} — switching from ${model} → ${models[m + 1]}`);
            }
            break; // move to next model
          }
          // Exponential backoff: 5s, 10s, 20s …
          const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1);
          console.warn(`  [rate-limit] ${label} (${model}) — waiting ${wait / 1000}s (attempt ${attempt}/${MAX_RETRIES})`);
          await sleep(wait);
        } else {
          throw err;
        }
      }
    }
  }
  throw new Error(`${label} failed on all models after ${MAX_RETRIES} retries each`);
}

// ── Step 1: extract from a single image ──────────────────────────────────────
async function extractFromImage(gemini, imagePath, year) {
  const { base64, mime } = imageToBase64(imagePath);
  const filename = path.basename(imagePath);

  const prompt = `You are an expert exam question digitiser. Extract every question from this image exactly as written.

Return a JSON array where each element has exactly these fields:
{
  "subject": string,       // e.g. "Mathematics", "Use of English", "Biology" — infer from content
  "topic": string,         // e.g. "ALGEBRA", "COMPREHENSION", "GENETICS" — infer from content
  "text": string,          // full question text; for comprehension include the passage prefixed with "PASSAGE: "
  "optionA": string|null,
  "optionB": string|null,
  "optionC": string|null,
  "optionD": string|null,
  "correctOption": "A"|"B"|"C"|"D"|null,  // null only if answer key not visible
  "year": number,   // read the exam year from the booklet header/footer/cover. If session shown like "2022/2023" use the first year (2022). Fallback: ${year}
  "difficulty": "EASY"|"MEDIUM"|"HARD",
  "explanation": string,   // brief explanation of why the correct answer is right
  "imageUrl": null
}

Rules:
- NEVER use LaTeX or backslash notation — write maths in plain text (e.g. "x^2", "2/3", "log base 2 of 8")
- If the question references a diagram not shown, append "[diagram required]" to the text field
- If no answer key is visible, set correctOption to null
- Do NOT include the question number in the text field
- Return ONLY the JSON array, no markdown fences, no prose`;

  const response = await callWithRetry((modelName) =>
    gemini.getGenerativeModel({ model: modelName }).generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: mime, data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
    `extract(${filename})`,
    [VISION_MODEL]
  );

  const raw = response.response.text().trim();

  // Strip markdown code fences if present, then repair any bad escape sequences
  const cleaned  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const repaired = sanitizeJson(cleaned);

  try {
    const questions = JSON.parse(repaired);
    if (!Array.isArray(questions)) throw new Error('not an array');
    return questions.map(q => ({ ...q, year: q.year ? Number(q.year) : Number(year) }));
  } catch (e) {
    console.error(`  [parse error] ${filename}: ${e.message}`);
    console.error('  Raw output (first 500 chars):', raw.slice(0, 500));
    return [];
  }
}

// ── Step 2: verify + fix explanations in batches ─────────────────────────────
async function verifyBatch(anthropic, questions, batchIndex) {
  const payload = questions.map((q, i) => ({
    i,
    text: q.text,
    options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
    correctOption: q.correctOption,
    explanation: q.explanation,
  }));

  const prompt = `You are a Nigerian post-UTME exam expert. Review these ${questions.length} questions and return a corrected JSON array.

For each question:
1. Verify the correctOption is actually correct — fix it if wrong
2. Rewrite the explanation to clearly justify the correct answer (2-4 sentences)
3. Keep all other fields exactly as-is
4. Do NOT use LaTeX or backslash notation in explanations — plain text only

Input:
${JSON.stringify(payload, null, 2)}

Return ONLY a JSON array with the same length and index order. Each element: { "i": number, "correctOption": string, "explanation": string }`;

  const response = await callWithRetry((modelName) =>
    anthropic.messages.create({
      model: modelName,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
    `verify(batch ${batchIndex})`,
    [CORRECTION_MODEL]
  );

  const raw     = response.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const corrections = JSON.parse(sanitizeJson(cleaned));
    if (!Array.isArray(corrections)) throw new Error('not an array');

    const updated = [...questions];
    for (const c of corrections) {
      if (typeof c.i === 'number' && c.i < updated.length) {
        if (c.correctOption) updated[c.i].correctOption = c.correctOption;
        if (c.explanation)   updated[c.i].explanation   = c.explanation;
      }
    }
    return updated;
  } catch (e) {
    console.warn(`  [verify parse error] batch ${batchIndex}: ${e.message} — keeping originals (${questions.length} questions unverified)`);
    return questions.map(q => ({ ...q, _unverified: true }));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args        = process.argv.slice(2);
  const correctOnly = args.includes('--correct-only');
  const [inputDir, outputFile, yearArg] = args.filter(a => !a.startsWith('--'));

  if (correctOnly && !inputDir) {
    console.error('Usage: node extract-questions.js <output.json> --correct-only');
    process.exit(1);
  }
  if (!correctOnly && (!inputDir || !outputFile)) {
    console.error('Usage: node extract-questions.js <photos-folder> <output.json> [year]');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log(`Correction model : ${CORRECTION_MODEL} (Claude)\n`);

  // ── Correct-only mode: read existing JSON and skip extraction ──────────────
  if (correctOnly) {
    const realOutput  = inputDir; // single positional arg is both the input source and output
    const partialPath = realOutput.replace(/\.json$/i, '-partial.json');

    // Prefer partial (still raw), fall back to the file the user passed directly
    const sourceFile = fs.existsSync(partialPath) ? partialPath : realOutput;
    if (!fs.existsSync(sourceFile)) {
      console.error(`No file found to correct: ${sourceFile}`);
      process.exit(1);
    }

    const allQuestions = JSON.parse(fs.readFileSync(sourceFile, 'utf8').replace(/^﻿/, ''));
    console.log(`Loaded ${allQuestions.length} questions from ${sourceFile}`);
    console.log(`Running correction pass (batches of ${VERIFY_BATCH})…\n`);

    const verified = [];
    for (let i = 0; i < allQuestions.length; i += VERIFY_BATCH) {
      const batch      = allQuestions.slice(i, i + VERIFY_BATCH);
      const batchNum   = Math.floor(i / VERIFY_BATCH) + 1;
      const totalBatch = Math.ceil(allQuestions.length / VERIFY_BATCH);
      console.log(`  Batch ${batchNum}/${totalBatch} (questions ${i + 1}–${Math.min(i + VERIFY_BATCH, allQuestions.length)})`);
      const corrected = await verifyBatch(anthropic, batch, batchNum);
      verified.push(...corrected);
      if (i + VERIFY_BATCH < allQuestions.length) await sleep(1500);
    }

    const unverifiedCount = verified.filter(q => q._unverified).length;
    if (unverifiedCount > 0) console.warn(`\nWARNING: ${unverifiedCount} question(s) could not be verified — manual review required.`);
    const clean = verified.map(({ _unverified, ...q }) => q);
    const needsImages = clean.filter(q => needsImageFlag(q.text) || q.text.includes('[diagram required]'));
    fs.writeFileSync(realOutput, JSON.stringify(clean, null, 2));
    console.log(`\nSaved ${clean.length} questions → ${realOutput}`);
    if (needsImages.length > 0) {
      const sidecarPath = realOutput.replace(/\.json$/i, '-needs-images.json');
      fs.writeFileSync(sidecarPath, JSON.stringify(needsImages.map(q => ({ text: q.text, subject: q.subject, topic: q.topic, note: 'Requires diagram/figure image' })), null, 2));
      console.log(`Flagged ${needsImages.length} question(s) needing images → ${sidecarPath}`);
    }
    console.log('\nDone. Upload the JSON at /admin/imports.\n');
    return;
  }

  // ── Normal mode ────────────────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is not set');
    process.exit(1);
  }

  const year   = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear();
  const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const allFiles = fs.readdirSync(inputDir)
    .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort(naturalSort);

  if (allFiles.length === 0) {
    console.error(`No image files found in: ${inputDir}`);
    process.exit(1);
  }

  const partialPath  = outputFile.replace(/\.json$/i, '-partial.json');
  const progressPath = outputFile.replace(/\.json$/i, '-progress.json');

  let allQuestions = [];
  let startIndex   = 0;

  if (fs.existsSync(partialPath) && fs.existsSync(progressPath)) {
    try {
      const progressRaw = fs.readFileSync(progressPath, 'utf8').replace(/^﻿/, '');
      const progress = JSON.parse(progressRaw);
      if (progress.totalImages === allFiles.length && progress.lastProcessedIndex >= 0) {
        const partialRaw = fs.readFileSync(partialPath, 'utf8').replace(/^﻿/, '');
        allQuestions = JSON.parse(partialRaw);
        startIndex   = progress.lastProcessedIndex + 1;
        console.log(`\nResuming from image ${startIndex + 1}/${allFiles.length} (${allQuestions.length} questions already extracted)`);
      }
    } catch (e) {
      console.warn(`Could not read progress files (${e.message}) — starting fresh`);
    }
  }

  if (startIndex === 0) {
    console.log(`\nFound ${allFiles.length} image(s) in "${inputDir}" — year fallback: ${year}`);
  }
  console.log(`Extraction model : ${VISION_MODEL} (Gemini)\n`);

  for (let idx = startIndex; idx < allFiles.length; idx++) {
    const file     = allFiles[idx];
    const fullPath = path.join(inputDir, file);
    console.log(`[${idx + 1}/${allFiles.length}] Extracting: ${file}`);

    const questions = await extractFromImage(gemini, fullPath, year);
    console.log(`  → ${questions.length} question(s) extracted`);
    allQuestions.push(...questions);

    fs.writeFileSync(partialPath,  JSON.stringify(allQuestions, null, 2));
    fs.writeFileSync(progressPath, JSON.stringify({ lastProcessedIndex: idx, totalImages: allFiles.length }));

    if (idx < allFiles.length - 1) await sleep(REQUEST_DELAY);
  }

  console.log(`\nExtraction complete. Total questions: ${allQuestions.length}`);

  // ── Phase 2: verify + correct explanations ─────────────────────────────────
  console.log(`\nRunning correction pass (batches of ${VERIFY_BATCH})…`);
  const verified = [];

  for (let i = 0; i < allQuestions.length; i += VERIFY_BATCH) {
    const batch      = allQuestions.slice(i, i + VERIFY_BATCH);
    const batchNum   = Math.floor(i / VERIFY_BATCH) + 1;
    const totalBatch = Math.ceil(allQuestions.length / VERIFY_BATCH);
    console.log(`  Batch ${batchNum}/${totalBatch} (questions ${i + 1}–${Math.min(i + VERIFY_BATCH, allQuestions.length)})`);

    const corrected = await verifyBatch(anthropic, batch, batchNum);
    verified.push(...corrected);

    if (i + VERIFY_BATCH < allQuestions.length) await sleep(1500);
  }

  // ── Phase 3: write outputs ─────────────────────────────────────────────────
  const unverifiedCount = verified.filter(q => q._unverified).length;
  if (unverifiedCount > 0) console.warn(`\nWARNING: ${unverifiedCount} question(s) could not be verified — manual review required.`);
  const clean = verified.map(({ _unverified, ...q }) => q);
  const needsImages = clean.filter(q => needsImageFlag(q.text) || q.text.includes('[diagram required]'));

  fs.writeFileSync(outputFile, JSON.stringify(clean, null, 2));
  console.log(`\nSaved ${clean.length} questions → ${outputFile}`);

  if (needsImages.length > 0) {
    const sidecarPath = outputFile.replace(/\.json$/i, '-needs-images.json');
    fs.writeFileSync(sidecarPath, JSON.stringify(needsImages.map(({ text, subject, topic }) => ({
      text, subject, topic, note: 'Requires diagram/figure image',
    })), null, 2));
    console.log(`Flagged ${needsImages.length} question(s) needing images → ${sidecarPath}`);
  }

  // Clean up partial + progress files
  if (fs.existsSync(partialPath))  fs.unlinkSync(partialPath);
  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);

  console.log('\nDone. Upload the JSON at /admin/imports (set school + examType there).\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message ?? err);
  process.exit(1);
});
