#!/usr/bin/env node
/**
 * extract-questions.js
 * Extracts Post-UTME exam questions from booklet photos using Gemini Vision,
 * then corrects and verifies answers with Claude.
 *
 * Usage:
 *   node extract-questions.js <photos-folder> <output.json> [year]
 *   node extract-questions.js <output.json> --correct-only
 *   node extract-questions.js <input.md> <output.json> --from-md [--provider groq|gemini|anthropic]
 *
 * --from-md converts a text/markdown booklet (no images) into the MOCK-EXAM
 * upload format ({ text, subject, options:[{label,text,isCorrect}], explanation })
 * used by /admin/mock/<id>/questions. Where the booklet supplies an "ANSWER: X"
 * line it is used; otherwise the model solves the question to pick the answer.
 * Provider defaults to Gemini (GEMINI_API_KEY — high free-tier limits); pass --provider groq or anthropic to switch.
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

// Load API keys from the project env files (this script reads process.env but
// isn't run through Next.js, so nothing loads them otherwise). .env.local wins:
// dotenv does not override already-set vars, so load it first.
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Config ────────────────────────────────────────────────────────────────────
const VISION_MODEL      = 'gemini-2.5-flash';          // Google Gemini — vision
const CORRECTION_MODEL  = 'claude-haiku-4-5-20251001'; // Anthropic — correction
const MOCK_MODEL        = 'claude-sonnet-4-6';         // Anthropic — markdown→mock (needs to SOLVE unanswered Qs)
const GROQ_MODEL        = 'llama-3.3-70b-versatile';    // Groq — markdown→mock (proven to work within free-tier TPM)
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

  const prompt = `You are an expert exam question digitiser for Nigerian post-UTME and JAMB booklets. Extract ONLY genuine exam questions from this image.

Return a JSON array where each element has exactly these fields:
{
  "subject": string,       // e.g. "Mathematics", "Use of English", "Biology" — infer from content
  "topic": string,         // e.g. "ALGEBRA", "COMPREHENSION", "GENETICS" — infer from content
  "text": string,          // the question stem ONLY — what a student is asked; must end with "?" or clearly be a question/instruction
  "optionA": string|null,
  "optionB": string|null,
  "optionC": string|null,
  "optionD": string|null,
  "correctOption": "A"|"B"|"C"|"D"|null,
  "year": number,   // read from booklet header/footer. If session "2022/2023" use 2022. Fallback: ${year}
  "difficulty": "EASY"|"MEDIUM"|"HARD",
  "explanation": string,   // YOUR OWN brief explanation of why the correct answer is right (1-2 sentences). Do NOT copy text from the image into this field.
  "imageUrl": null
}

STRICT RULES — violating any rule means the entry is wrong:
1. QUESTIONS ONLY: The "text" field must be a genuine exam question or instruction (e.g. "Find the value of x", "Which of the following..."). NEVER put answer explanations, solution workings, footnotes, page headers, or answer keys in the "text" field. If text is partially illegible, use your subject knowledge to reconstruct the most likely question.
2. OPTIONS: Transcribe ALL 4 option texts (A, B, C, D). If an option is partially legible, use your subject knowledge to complete it sensibly — a plausible option is better than null. Only set options to null if the text is completely illegible or absent.
3. USE LATEX: Write maths in plain text and latex in where it's befitted  — "x^2" or "$x^2$", "sqrt(3)" or "\\sqrt{3}", "pi" or "\\pi".
4. BOLD/ITALICS: Represent bold as *word* and italics as _word_ in plain text.
5. SKIP non-questions: Instructions pages, answer keys, passages (unless they are followed by comprehension questions), worked examples, and explanatory text are NOT questions — omit them entirely.
6. Do NOT include the question number in the text field.
7. Return ONLY the JSON array, no markdown fences, no prose.`;

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

// ── Markdown mode: convert a text booklet into mock-exam JSON ────────────────

// Conservative question-start detector. Used ONLY to choose safe chunk
// boundaries so a single question is never split across two API calls — being
// strict here means chunks may run a little long, never that a question is cut.
function isQuestionStart(line) {
  return /^\s*\d+\.\s/.test(line)        // "1. ..."        numbered (English + General Paper)
      || /^\s*Q:/i.test(line)            // "Q: ..."        maths section
      || /^\s*•?\s*From\b/i.test(line);  // "• From the..."  English bulleted stems
}

function chunkByQuestions(text, maxChars = 2500) {
  const lines  = text.split(/\r?\n/);
  const chunks = [];
  let current = [];
  let size    = 0;
  for (const line of lines) {
    if (size >= maxChars && current.length && isQuestionStart(line)) {
      chunks.push(current.join('\n'));
      current = [];
      size    = 0;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length) chunks.push(current.join('\n'));
  return chunks;
}

function normalizeText(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Pull out every balanced top-level {...} object, ignoring braces inside strings.
// Lets us recover whole questions even when the model's JSON array is truncated
// mid-object (hit max_tokens) — the unclosed tail simply never matches and is dropped.
function extractJsonObjects(str) {
  const objs = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') { if (depth++ === 0) start = i; }
    else if (ch === '}') { if (--depth === 0 && start !== -1) { objs.push(str.slice(start, i + 1)); start = -1; } }
  }
  return objs;
}

// Returns null when valid, else a human-readable reason it needs manual review.
function validateMockQuestion(q) {
  if (!q || typeof q.text !== 'string' || !q.text.trim()) return 'missing question text';
  if (!Array.isArray(q.options) || q.options.length < 2)  return 'fewer than 2 options';
  const badShape = q.options.some(o => !o || typeof o.text !== 'string' || !o.text.trim() || !/^[A-E]$/.test(o.label ?? ''));
  if (badShape) return 'malformed option (label must be A–E with text)';
  const correct = q.options.filter(o => o.isCorrect === true).length;
  if (correct !== 1) return `expected exactly 1 correct option, found ${correct}`;
  const labels = q.options.map(o => o.label);
  const isAtoD = q.options.length === 4 && ['A', 'B', 'C', 'D'].every((l, i) => labels[i] === l);
  if (!isAtoD) return 'not exactly A–D (mock exams only support 4 options A–D)';
  return null;
}

// `complete(prompt, label)` runs one chat/text completion and resolves to the
// raw model text. Provider is chosen in runFromMarkdown so this stays generic.
async function convertChunk(complete, chunkText, chunkIndex) {
  const prompt = `You are digitising a Nigerian JAMB / Post-UTME mock-exam booklet. Below is raw text (possibly OCR'd) containing multiple-choice questions. Convert it into structured JSON.

Output a JSON array. Each element is ONE question:
{
  "text": string,        // the question stem ONLY — no leading number, bullet, or "Q:"
  "subject": string,     // infer: the "ENGLISH LANGUAGE" section -> "Use of English"; the civil-service "GENERAL PAPER" section -> "General Paper"; the "Q:"-prefixed maths -> "Mathematics"
  "options": [
    { "label": "A", "text": string, "isCorrect": boolean },
    { "label": "B", "text": string, "isCorrect": boolean },
    { "label": "C", "text": string, "isCorrect": boolean },
    { "label": "D", "text": string, "isCorrect": boolean }
  ],
  "explanation": string  // 1-2 sentences justifying the correct answer; math in $...$ LaTeX, same as below
}

The "text", every option "text", and "explanation" are rendered with KaTeX + lightweight markdown, so format them accordingly.

RULES — breaking any one makes the entry wrong:
1. LABELS: always uppercase A, B, C, D. Re-letter "(a)/(b)/(c)/(d)" to A/B/C/D. If a question genuinely has a 5th option, add it as "E" — do not drop or merge options.
2. EXACTLY ONE option must have "isCorrect": true.
3. ANSWER KEY: if the booklet states the answer (a line like "ANSWER: C"), trust it and mark that option correct. NEVER put the "ANSWER: X" line into the text or an option.
4. NO KEY GIVEN: if no answer is provided, SOLVE the question yourself (antonym, synonym, grammar, comprehension, calculation, etc.) and mark the option you determine is correct.
5. SKIP non-questions entirely: section titles ("ENGLISH LANGUAGE", "GENERAL PAPER"), standalone page numbers, and any instruction/stem that has no options.
6. DUPLICATES: some questions appear more than once in the booklet — just convert each as you meet it; duplicates are removed afterwards.
7. MATHS → LaTeX: wrap EVERY mathematical expression, equation, variable, number-with-unit, or symbol in inline LaTeX delimiters $...$ using valid KaTeX syntax. In JSON every backslash MUST be written doubled. Examples of correct option/text values:
     "2y + 5x - 4 = 0"  -> "$2y + 5x - 4 = 0$"
     "x^2" -> "$x^2$";  "sqrt(3)" -> "$\\\\sqrt{3}$";  "3/4" -> "$\\\\frac{3}{4}$"
     "pi" -> "$\\\\pi$";  "sin30" -> "$\\\\sin 30^\\\\circ$";  "3 x 10^8 m/s" -> "$3 \\\\times 10^{8}\\\\ \\\\text{m/s}$"
     binary "10.011two" -> "$10.011_2$";  "<=" -> "$\\\\le$";  a lone variable like x -> "$x$".
   Use $$...$$ only for a large standalone display equation (rare here).
8. EMPHASIS: this text has lost the booklet's original bold/italic styling, so do NOT guess it and do NOT use underscores. The only allowed formatting is bolding genuine negation/emphasis words (NOT, EXCEPT, ALL, ONLY) with **WORD**.
9. Reminder: a backslash inside a JSON string is written as two characters, e.g. "\\\\sqrt", "\\\\frac", "\\\\pi", "\\\\times".
10. Return ONLY the JSON array — no markdown fences, no prose.

RAW TEXT:
${chunkText}`;

  const raw     = (await complete(prompt, `convert(chunk ${chunkIndex})`)).trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Parse RAW first — the model now emits valid JSON with correctly-doubled
  // LaTeX backslashes (e.g. "$\\ \\text{cm}$"). sanitizeJson would corrupt that
  // valid "\\ " into an invalid "\ ", so only use it as a fallback for genuinely
  // broken (single-backslash) output.
  const tryParse = (s) => {
    try { return JSON.parse(s); } catch {}
    try { return JSON.parse(sanitizeJson(s)); } catch {}
    return undefined;
  };

  const whole = tryParse(cleaned);
  if (Array.isArray(whole)) return whole;

  // Salvage: parse each complete object independently so a truncated or single
  // malformed object costs only itself, not the whole chunk.
  const salvaged = [];
  for (const objStr of extractJsonObjects(cleaned)) {
    const obj = tryParse(objStr);
    if (obj) salvaged.push(obj);
  }
  if (salvaged.length > 0) {
    console.warn(`  [salvaged] chunk ${chunkIndex}: recovered ${salvaged.length} question(s) from malformed/truncated JSON`);
    return salvaged;
  }

  console.error(`  [parse error] chunk ${chunkIndex}: no recoverable questions`);
  console.error('  Raw output (first 500 chars):', raw.slice(0, 500));
  return [];
}

// Build a completer for the chosen provider. Returns { label, complete, delayMs }
// where complete(prompt, label) resolves to the raw model text and delayMs is the
// pause between chunks. Defaults to Groq (reuses GROQ_API_KEY).
function buildCompleter(provider) {
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Error: ANTHROPIC_API_KEY is not set (needed for --provider anthropic)');
      process.exit(1);
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return {
      label: `${MOCK_MODEL} (Claude)`,
      delayMs: 1500,
      complete: (prompt, lbl) => callWithRetry((model) =>
        anthropic.messages.create({ model, max_tokens: 8192, messages: [{ role: 'user', content: prompt }] })
          .then(r => r.content[0].text),
        lbl, [MOCK_MODEL]),
    };
  }

  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      console.error('Error: GEMINI_API_KEY is not set (needed for --provider gemini)');
      process.exit(1);
    }
    const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return {
      label: `${VISION_MODEL} (Gemini)`,
      delayMs: 4500,
      complete: (prompt, lbl) => callWithRetry((model) =>
        gemini.getGenerativeModel({ model }).generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }).then(r => r.response.text()),
        lbl, [VISION_MODEL]),
    };
  }

  // Default: Groq (OpenAI-compatible). Free-tier tokens-per-minute is the limit,
  // so chunks are paced ~10s apart; callWithRetry backs off further on any 429.
  if (!process.env.GROQ_API_KEY) {
    console.error('Error: GROQ_API_KEY is not set (needed for the default Groq provider)');
    process.exit(1);
  }
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return {
    label: `${GROQ_MODEL} (Groq)`,
    // Groq free tier ≈ 8000 TPM and counts max_tokens against it, so keep the
    // reservation small (input ~2k + 4k ≈ 6k < 8k) and pace ~30s apart.
    delayMs: 30000,
    complete: (prompt, lbl) => callWithRetry((model) =>
      groq.chat.completions.create({
        model, max_tokens: 4096, temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }).then(r => r.choices[0].message.content),
      lbl, [GROQ_MODEL]),
  };
}

async function runFromMarkdown(inputPath, outputFile, provider) {
  if (!inputPath || !outputFile) {
    console.error('Usage: node extract-questions.js <input.md> <output.json> --from-md [--provider gemini|anthropic]');
    process.exit(1);
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const { label, complete, delayMs } = buildCompleter(provider);
  const text   = fs.readFileSync(inputPath, 'utf8').replace(/^﻿/, '');
  const chunks = chunkByQuestions(text);

  // Incremental save + resume: every successful chunk is flushed to disk, so a
  // rate-limit/crash never loses prior work — just re-run the SAME command.
  const partialPath  = outputFile.replace(/\.json$/i, '-partial.json');
  const progressPath = outputFile.replace(/\.json$/i, '-progress.json');

  let all = [];
  let startChunk = 0;
  if (fs.existsSync(partialPath) && fs.existsSync(progressPath)) {
    try {
      const prog = JSON.parse(fs.readFileSync(progressPath, 'utf8').replace(/^﻿/, ''));
      if (prog.totalChunks === chunks.length && prog.lastChunk >= 0) {
        all = JSON.parse(fs.readFileSync(partialPath, 'utf8').replace(/^﻿/, ''));
        startChunk = prog.lastChunk + 1;
        console.log(`Resuming at chunk ${startChunk + 1}/${chunks.length} (${all.length} question(s) already saved)`);
      }
    } catch (e) {
      console.warn(`Could not read progress (${e.message}) — starting fresh`);
    }
  }

  console.log(`Loaded "${inputPath}" — ${chunks.length} chunk(s)`);
  console.log(`Conversion model : ${label}\n`);

  for (let i = startChunk; i < chunks.length; i++) {
    console.log(`  Chunk ${i + 1}/${chunks.length}`);
    let qs;
    try {
      qs = await convertChunk(complete, chunks[i], i + 1);
    } catch (err) {
      console.error(`\n  Stopped at chunk ${i + 1}: ${err.message ?? err}`);
      console.error(`  ${all.length} question(s) saved to ${partialPath}. Re-run the SAME command to resume.\n`);
      return; // partial + progress from prior chunks are already on disk
    }
    console.log(`    → ${qs.length} question(s)`);
    all.push(...qs);
    fs.writeFileSync(partialPath,  JSON.stringify(all, null, 2));
    fs.writeFileSync(progressPath, JSON.stringify({ lastChunk: i, totalChunks: chunks.length }));
    if (i < chunks.length - 1) await sleep(delayMs);
  }

  // Drop verbatim duplicates (the booklet repeats whole blocks).
  const seen = new Set();
  const deduped = all.filter(q => {
    const key = normalizeText(q && q.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Split into upload-ready vs. needs-manual-review (e.g. 5-option maths).
  const valid = [];
  const needsReview = [];
  for (const q of deduped) {
    const reason = validateMockQuestion(q);
    const clean  = {
      text:        String(q.text).trim(),
      subject:     (q.subject && String(q.subject).trim()) || 'General',
      options:     q.options,
      explanation: q.explanation ? String(q.explanation).trim() : '',
    };
    if (reason) needsReview.push({ ...clean, _reason: reason });
    else valid.push(clean);
  }

  fs.writeFileSync(outputFile, JSON.stringify(valid, null, 2));
  console.log(`\nSaved ${valid.length} upload-ready question(s) → ${outputFile}`);

  if (needsReview.length > 0) {
    const sidecar = outputFile.replace(/\.json$/i, '-needs-review.json');
    fs.writeFileSync(sidecar, JSON.stringify(needsReview, null, 2));
    console.log(`Flagged ${needsReview.length} question(s) needing manual review → ${sidecar}`);
  }

  // All chunks done — clear the resume checkpoint.
  if (fs.existsSync(partialPath))  fs.unlinkSync(partialPath);
  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);

  console.log('\nDone. Upload the JSON at /admin/mock/<id>/questions (Upload Questions panel).\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args        = process.argv.slice(2);
  const correctOnly = args.includes('--correct-only');
  const fromMd      = args.includes('--from-md');
  const [inputDir, outputFile, yearArg] = args.filter(a => !a.startsWith('--'));

  if (correctOnly && !inputDir) {
    console.error('Usage: node extract-questions.js <output.json> --correct-only');
    process.exit(1);
  }
  if (!correctOnly && !fromMd && (!inputDir || !outputFile)) {
    console.error('Usage: node extract-questions.js <photos-folder> <output.json> [year]');
    process.exit(1);
  }

  // ── Markdown mode: convert a text booklet straight into mock-exam JSON ──────
  // Picks its own provider (Gemini by default) so it runs even without Claude credits.
  if (fromMd) {
    const pIdx     = args.indexOf('--provider');
    const provider = pIdx !== -1 ? args[pIdx + 1] : 'gemini';
    await runFromMarkdown(inputDir, outputFile, provider);
    return;
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
