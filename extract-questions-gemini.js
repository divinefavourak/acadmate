#!/usr/bin/env node
/**
 * Acadmate — Post-UTME Question Extractor (Gemini variant)
 *
 * Usage:
 *   node extract-questions-gemini.js <images-folder> [output.json] [--year YYYY]
 *
 * Examples:
 *   node extract-questions-gemini.js ./unilag-maths
 *   node extract-questions-gemini.js ./photos  unilag-2024.json --year 2024
 *
 * Setup:
 *   npm install @google/generative-ai
 *   $env:GEMINI_API_KEY="your_key_here"   (PowerShell)
 *   export GEMINI_API_KEY=your_key_here   (Linux/Mac)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── EXTRACTION PROMPT ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at extracting Nigerian university Post-UTME past exam questions from booklet photos.

STEP 1 — Identify the page type:
- "QUESTIONS": Only has numbered questions with A/B/C/D options. No solutions.
- "SOLUTIONS": Only has step-by-step workings and "Answer: X" labels. No question options.
- "MIXED": Has BOTH questions with options AND their solutions/answers on the same page.

STEP 2 — Extract accordingly.

STEP 3 — For every question, assess diagrams using these rules:

DIAGRAM RULES:
A question "has a diagram" if it contains: a geometric figure, a graph, a drawn shape,
a coordinate plane, a circuit, a Venn diagram drawn as a figure, or any visual that
cannot be described in a single sentence.

A question does NOT have a diagram if it only contains text, numbers, or math expressions.

For questions WITH diagrams:
- Set "diagramComplexity" to "SIMPLE" or "COMPLEX":
  - SIMPLE: A clear text description fully conveys the question.
    e.g. "A chord of length 8cm is drawn 3cm from the centre of a circle."
    → Write the description INTO the question text. Set hasImage: false.
  - COMPLEX: The diagram has specific coordinates, a drawn graph, multiple labelled
    points, or details that lose meaning without the actual image.
    → Write the best text description you can into the question text prefixed with [DIAGRAM: ...].
    → Set hasImage: true and imageUrl: null so it gets flagged for manual upload.

═══════════════════════════════════════════
OUTPUT FORMAT — Return ONLY raw valid JSON. No markdown. No explanation. No backticks.
═══════════════════════════════════════════

For "QUESTIONS" page:
{
  "pageType": "QUESTIONS",
  "school": "UNILAG",
  "subject": "Mathematics",
  "year": 2026,
  "questions": [
    {
      "questionNumber": 1,
      "topic": "NUMBER BASES",
      "text": "Convert 101101₂ to base 10.",
      "optionA": "45",
      "optionB": "40",
      "optionC": "35",
      "optionD": "50",
      "difficulty": "EASY",
      "hasImage": false,
      "imageUrl": null,
      "diagramComplexity": null
    }
  ]
}

For "SOLUTIONS" page:
{
  "pageType": "SOLUTIONS",
  "answers": [
    {
      "questionNumber": 1,
      "correctOption": "A",
      "explanation": "Multiply each digit by its place value: 1×32 + 0×16 + 1×8 + 1×4 + 0×2 + 1×1 = 45."
    }
  ]
}

For "MIXED" page — questions with correctOption and explanation included:
{
  "pageType": "MIXED",
  "school": "UNILAG",
  "subject": "Mathematics",
  "year": 2026,
  "questions": [
    {
      "questionNumber": 1,
      "topic": "NUMBER BASES",
      "text": "Convert 101101₂ to base 10.",
      "optionA": "45",
      "optionB": "40",
      "optionC": "35",
      "optionD": "50",
      "correctOption": "A",
      "explanation": "Multiply each bit by its place value: 1×32 + 0×16 + 1×8 + 1×4 + 0×2 + 1×1 = 45.",
      "difficulty": "EASY",
      "hasImage": false,
      "imageUrl": null,
      "diagramComplexity": null
    }
  ]
}

ADDITIONAL RULES:
1. English COMPREHENSION: embed the full passage into each related question's text:
   "text": "PASSAGE: [full passage text]\\n\\n[actual question]"
   Do this for every question that refers to the passage (usually Q1–4).

2. Topic: look for "QUESTION X — TOPIC NAME" headers.

3. Subject: read the page header. Use EXACTLY one of these DB subject names — do not invent variants:
   "Mathematics", "Use of English", "Physics", "Chemistry", "Biology",
   "Economics", "Government", "Literature in English", "Geography",
   "Agricultural Science", "Commerce", "Accounts",
   "Christian Religious Knowledge", "General Knowledge".
   Common mappings:
   "English Language" / "English" → "Use of English"
   "Accounting" / "Financial Accounting" → "Accounts"
   "CRS" / "CRK" / "Christian Religious Studies" → "Christian Religious Knowledge"
   "Current Affairs" / "General Studies" / "Aptitude" / "Verbal Reasoning" → "General Knowledge"
   "Lit in English" → "Literature in English"

4. Year: look for "2025/2026". Use the later year (2026).

5. Math expressions — use plain text or LaTeX: √50, x², \\frac{3}{4}, 3^{x+1}

6. difficulty: "EASY" for simple recall, "HARD" for multi-step problems, "MEDIUM" for everything else.
   Always include the difficulty field on every question.

7. Never return an empty questions array. If text is unclear, make your best guess.

8. Return ONLY the JSON. Nothing else.`;

// ─── CORRECTION PROMPT ───────────────────────────────────────────────────────

const CORRECT_SYSTEM_PROMPT = `You are reviewing multiple-choice exam questions and their explanations.

For each question, check whether the explanation correctly explains why the given correctOption is right.

Rules:
- If the explanation is correct and matches → return nothing for that question.
- If the explanation is wrong, missing, blank, or explains a different problem → write a correct one.

Return ONLY raw valid JSON:
{
  "corrections": [
    { "questionNumber": 3, "explanation": "The correct step-by-step explanation here." }
  ]
}

If nothing needs fixing, return: {"corrections": []}`;

// ─── RETRY HELPER ────────────────────────────────────────────────────────────

function parseGeminiRetryDelay(err) {
  // Gemini embeds a RetryInfo block in the error message: "retryDelay":"50s"
  try {
    const match = err?.message?.match(/"retryDelay"\s*:\s*"(\d+)s"/);
    if (match) return parseInt(match[1], 10) * 1000 + 2000; // add 2s buffer
  } catch {}
  return null;
}

function isDailyQuotaExhausted(err) {
  return /PerDay/i.test(err?.message ?? "");
}

async function withRetry(fn, label, maxRetries = 4) {
  let delay = 15000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.httpError?.status;
      const retryable = status === 429 || status === 503 || status === 529 ||
        /quota|overload|rate.?limit|resource.?exhaust/i.test(err?.message ?? "");

      if (isDailyQuotaExhausted(err)) {
        console.error("\n❌ Daily quota exhausted — your free-tier allowance is used up for today.");
        console.error("   Options:");
        console.error("   • Wait until tomorrow (quota resets ~midnight Pacific)");
        console.error("   • Add billing at https://aistudio.google.com to get a paid quota");
        console.error("   • Switch to gemini-1.5-flash-8b (higher free-tier limits)");
        process.exit(1);
      }

      if (retryable && attempt < maxRetries) {
        const geminiDelay = parseGeminiRetryDelay(err);
        const wait = geminiDelay ?? delay;
        process.stdout.write(` [rate limited, waiting ${wait / 1000}s] `);
        await new Promise((r) => setTimeout(r, wait));
        delay = Math.min(delay * 2, 120000);
      } else {
        throw err;
      }
    }
  }
}

// ─── IMAGE PROCESSING ────────────────────────────────────────────────────────

async function extractFromImage(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString("base64");
  const ext = path.extname(imagePath).toLowerCase().slice(1);
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await withRetry(
    () => model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      "Extract all questions and/or answers from this page. Return ONLY valid JSON, nothing else.",
    ]),
    imagePath,
  );

  const raw = result.response.text().trim();
  const clean = raw.replace(/^```[a-z]*\n?|\n?```$/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse JSON response");
  }
}

// ─── EXPLANATION CORRECTION ───────────────────────────────────────────────────

async function correctExplanations(questions) {
  const BATCH = 20;
  const corrections = new Map();

  const correctable = questions.filter((q) => q.correctOption);
  if (correctable.length === 0) return corrections;

  console.log(`\nChecking and correcting explanations...`);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: CORRECT_SYSTEM_PROMPT,
  });

  for (let i = 0; i < correctable.length; i += BATCH) {
    const batch = correctable.slice(i, i + BATCH);
    const batchLabel = `Q${batch[0].questionNumber}–Q${batch[batch.length - 1].questionNumber}`;
    process.stdout.write(`   ${batchLabel} ... `);

    const payload = batch.map((q) => ({
      questionNumber: q.questionNumber,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      explanation: q.explanation || "",
    }));

    try {
      const result = await withRetry(
        () => model.generateContent(JSON.stringify(payload)),
        batchLabel,
      );

      const raw = result.response.text().trim().replace(/^```[a-z]*\n?|\n?```$/g, "").trim();
      const parsed = JSON.parse(raw);
      const fixed = parsed.corrections || [];
      fixed.forEach((c) => corrections.set(c.questionNumber, c.explanation));
      console.log(fixed.length === 0 ? "OK" : `fixed ${fixed.length}`);
    } catch (err) {
      console.log(`SKIPPED — ${err.message}`);
    }

    if (i + BATCH < correctable.length) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  return corrections;
}

// ─── MERGING ─────────────────────────────────────────────────────────────────

function mergeQuestionsWithAnswers(questionPages, solutionPages) {
  const answerMap = {};
  for (const sol of solutionPages) {
    for (const ans of sol.answers || []) {
      answerMap[ans.questionNumber] = ans;
    }
  }

  const merged = [];
  for (const qPage of questionPages) {
    for (const q of qPage.questions || []) {
      const ans = answerMap[q.questionNumber];
      merged.push({
        ...q,
        correctOption: ans?.correctOption || null,
        explanation: ans?.explanation || "",
        subject: q.subject || qPage.subject,
        year: q.year || qPage.year,
        school: q.school || qPage.school,
      });
    }
  }
  return merged;
}

// ─── NORMALIZE correctOption ──────────────────────────────────────────────────

function normalizeCorrectOption(raw) {
  if (!raw) return null;
  const letter = String(raw).trim().toUpperCase().match(/[A-D]/);
  return letter ? letter[0] : null;
}

// ─── SUBJECT NAME NORMALISATION ──────────────────────────────────────────────

const SUBJECT_MAP = {
  "english language":              "Use of English",
  "english":                       "Use of English",
  "use of english":                "Use of English",
  "lit in english":                "Literature in English",
  "lit-in-english":                "Literature in English",
  "literature":                    "Literature in English",
  "literature in english":         "Literature in English",
  "maths":                         "Mathematics",
  "mathematics":                   "Mathematics",
  "physics":                       "Physics",
  "chemistry":                     "Chemistry",
  "biology":                       "Biology",
  "economics":                     "Economics",
  "government":                    "Government",
  "geography":                     "Geography",
  "agricultural science":          "Agricultural Science",
  "agriculture":                   "Agricultural Science",
  "commerce":                      "Commerce",
  "accounting":                    "Accounts",
  "accounts":                      "Accounts",
  "financial accounting":          "Accounts",
  "christian religious studies":   "Christian Religious Knowledge",
  "christian religious knowledge": "Christian Religious Knowledge",
  "crs":                           "Christian Religious Knowledge",
  "crk":                           "Christian Religious Knowledge",
  "general knowledge":             "General Knowledge",
  "current affairs":               "General Knowledge",
  "general studies":               "General Knowledge",
  "aptitude":                      "General Knowledge",
  "verbal reasoning":              "General Knowledge",
  "quantitative reasoning":        "General Knowledge",
};

function normalizeSubject(raw) {
  if (!raw) return "General";
  return SUBJECT_MAP[raw.trim().toLowerCase()] ?? raw.trim();
}

// ─── CONVERT TO IMPORT FORMAT ────────────────────────────────────────────────

function toImportFormat(questions, corrections, yearOverride) {
  return questions
    .filter((q) => normalizeCorrectOption(q.correctOption))
    .map((q) => ({
      subject: normalizeSubject(q.subject),
      topic: q.topic || "General",
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: normalizeCorrectOption(q.correctOption),
      year: yearOverride ?? q.year ?? new Date().getFullYear(),
      difficulty: q.difficulty || "MEDIUM",
      explanation: corrections.get(q.questionNumber) ?? q.explanation ?? "",
      imageUrl: q.imageUrl || null,
      _needsImage: q.hasImage === true,
      _topic: q.topic,
      _text_preview: q.text?.substring(0, 100),
    }));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function processFolder(folderPath, outputPath, yearOverride) {
  const supported = [".jpg", ".jpeg", ".png"];
  const files = fs
    .readdirSync(folderPath)
    .filter((f) => supported.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((f) => path.join(folderPath, f));

  if (files.length === 0) {
    console.error("❌ No image files found in folder.");
    process.exit(1);
  }

  console.log(`\n📚 Found ${files.length} image(s). Starting extraction...\n`);
  console.log("─".repeat(55));

  const mixedQuestions = [];
  const questionPages = [];
  const solutionPages = [];

  let questionOffset = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filename = path.basename(file);
    process.stdout.write(`[${i + 1}/${files.length}] ${filename} ... `);

    try {
      const result = await extractFromImage(file);
      const count = result.questions?.length || result.answers?.length || 0;
      console.log(`${result.pageType} (${count} items)`);

      if (result.pageType === "MIXED") {
        mixedQuestions.push(
          ...(result.questions || []).map((q) => ({
            ...q,
            subject: q.subject || result.subject,
            year: q.year || result.year,
            school: q.school || result.school,
          }))
        );
      } else if (result.pageType === "QUESTIONS") {
        const pageQuestions = result.questions || [];
        const firstNum = pageQuestions[0]?.questionNumber ?? 1;
        const needsOffset = firstNum <= questionOffset;
        if (needsOffset) {
          pageQuestions.forEach((q) => { q.questionNumber += questionOffset; });
        }
        questionOffset = Math.max(questionOffset, ...pageQuestions.map((q) => q.questionNumber));
        questionPages.push({ ...result, questions: pageQuestions });
      } else if (result.pageType === "SOLUTIONS") {
        solutionPages.push(result);
      }
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
    }

    if (i < files.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("─".repeat(55));

  const mergedQuestions = mergeQuestionsWithAnswers(questionPages, solutionPages);
  const allQuestions = [...mixedQuestions, ...mergedQuestions];

  const corrections = await correctExplanations(allQuestions);
  const formatted = toImportFormat(allQuestions, corrections, yearOverride);

  const needsImage = formatted.filter((q) => q._needsImage);
  const skipped = mergedQuestions.filter((q) => !normalizeCorrectOption(q.correctOption)).length;

  const cleanOutput = formatted.map(({ _needsImage, _topic, _text_preview, ...clean }) => clean);

  fs.writeFileSync(outputPath, JSON.stringify(cleanOutput, null, 2));

  if (needsImage.length > 0) {
    const flagPath = outputPath.replace(".json", "-needs-images.json");
    const flagReport = needsImage.map((q, i) => ({
      number: i + 1,
      topic: q._topic || q.topic,
      preview: q._text_preview,
      instruction:
        "Take a clear photo of this diagram → upload to Cloudinary → paste the URL into imageUrl in the main output file, then re-import.",
      imageUrl: null,
    }));
    fs.writeFileSync(flagPath, JSON.stringify(flagReport, null, 2));
  }

  console.log(`\n✅ Done!`);
  console.log(`   Total extracted     : ${cleanOutput.length} questions`);
  console.log(`   Explanations fixed  : ${corrections.size}`);

  if (needsImage.length > 0) {
    console.log(`   Need diagram images : ${needsImage.length} → ${path.basename(outputPath.replace(".json", "-needs-images.json"))}`);
  } else {
    console.log(`   Diagram questions   : all handled via text description`);
  }

  if (skipped > 0) {
    console.log(`   No answer matched   : ${skipped} skipped (solutions page missing?)`);
  }

  console.log(`\n   📁 Output file      : ${outputPath}`);
  console.log(`\n👉 Upload at: /admin/imports\n`);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Acadmate — Post-UTME Question Extractor (Gemini)
─────────────────────────────────────────────────
Usage:
  node extract-questions-gemini.js <images-folder> [output.json] [--year YYYY]

Examples:
  node extract-questions-gemini.js ./unilag-maths
  node extract-questions-gemini.js ./unilag-english  output-english.json
  node extract-questions-gemini.js ./old-booklet     unilag-2022.json --year 2022

Flags:
  --year YYYY   Override the year on every question (useful when the booklet
                header is missing, unclear, or you're digitising old papers)

Setup (run once):
  npm install @google/generative-ai

Set API key:
  PowerShell : $env:GEMINI_API_KEY="your_key_here"
  Linux/Mac  : export GEMINI_API_KEY=your_key_here
`);
  process.exit(0);
}

const positional = args.filter((a) => !a.startsWith("--"));
const yearFlagIdx = args.indexOf("--year");
const yearOverride = yearFlagIdx !== -1 ? parseInt(args[yearFlagIdx + 1], 10) : null;

if (yearFlagIdx !== -1 && (isNaN(yearOverride) || yearOverride < 1990 || yearOverride > 2100)) {
  console.error("❌ --year must be a valid 4-digit year, e.g. --year 2022");
  process.exit(1);
}

const folderPath = path.resolve(positional[0]);
const outputPath = path.resolve(positional[1] || "questions-output.json");

if (!fs.existsSync(folderPath)) {
  console.error(`❌ Folder not found: ${folderPath}`);
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not set.");
  console.error('   PowerShell : $env:GEMINI_API_KEY="your_key_here"');
  console.error("   Linux/Mac  : export GEMINI_API_KEY=your_key_here");
  process.exit(1);
}

if (yearOverride) console.log(`📅 Year override: ${yearOverride}\n`);

processFolder(folderPath, outputPath, yearOverride).catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
