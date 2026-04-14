/**
 * JAMB Past Questions Seeder
 *
 * - GOV, ECO, BIO, LIT: Pure Python regex parser (no AI — have embedded answer keys)
 * - ENG, COM, ACC, CRK: Groq AI extraction (no answer keys in PDFs, no LaTeX)
 * - MTH, CHM, PHY:      Groq AI extraction with LaTeX reconstruction
 *
 * Usage:
 *   Set DATABASE_URL in your terminal, then:
 *   npx tsx prisma/seed-jamb-questions.ts [SUBJECT_CODE]
 */

import { execSync, execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import Groq from "groq-sdk";
import * as path from "path";
import * as crypto from "crypto";

if (!process.env.DIRECT_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

// Increase timeouts so Neon cold-start (1-3s) doesn't time out the connection pool
const dbUrl = process.env.DIRECT_URL
  .replace(/connect_timeout=\d+/, "connect_timeout=30")
  .replace(/pool_timeout=\d+/, "pool_timeout=60");

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

const PDF_DIR = path.join(process.cwd(), "question_pdfs");

// parser: "python" = pure regex (has answer keys), "groq" = AI extraction
const SUBJECTS: Record<string, { file: string; hasLatex: boolean; parser: "python" | "groq" }> = {
  // ENG: comprehension-based (passage-dependent answers) — skip AI extraction
  // ENG: { file: "Use-of-English-JAMB-Past-Questions-And-Answers.pdf", hasLatex: false, parser: "groq" },
  MTH: { file: "MATHEMATICS-JAMB-Past-Questions.pdf",                          hasLatex: true,  parser: "groq" },
  BIO: { file: "JAMB-Biology-Past-Questions-and-Answers.pdf",                  hasLatex: false, parser: "python" },
  CHM: { file: "CHEMISTRY-JAMB-Past-Questions.pdf",                            hasLatex: true,  parser: "groq" },
  PHY: { file: "Physics-JAMB-Past-Questions.pdf",                              hasLatex: true,  parser: "groq" },
  GOV: { file: "Government-JAMB-Past-Questions-And-Answers.pdf",               hasLatex: false, parser: "python" },
  ECO: { file: "JAMB-Economics-Past-Questions-and-Answers.pdf",                hasLatex: false, parser: "python" },
  LIT: { file: "Literature-In-English-JAMB-Past-Questions-and-Answers.pdf",    hasLatex: false, parser: "python" },
  COM: { file: "COMMERCE-JAMB-Past-Questions.pdf",                             hasLatex: false, parser: "python" },
  ACC: { file: "Principles-of-Accounts-JAMB-Past-Questions.pdf",               hasLatex: false, parser: "python" },
  CRK: { file: "CRK-JAMB-Past-Questions.pdf",                                  hasLatex: false, parser: "python" },
};

type ExtractedQuestion = {
  text: string;
  year: number | null;
  options: { label: string; text: string; isCorrect: boolean }[];
  explanation: string;
};

// ─── Python parser ──────────────────────────────────────────────────────────

function extractQuestionsViaPython(pdfPath: string, code: string): ExtractedQuestion[] {
  const scriptPath = path.join(process.cwd(), "prisma", "parse-jamb-pdf.py");
  try {
    const output = execFileSync("python", [scriptPath, pdfPath, code], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 120_000,
      encoding: "utf8",
    });
    const parsed = JSON.parse(output);
    if (!Array.isArray(parsed)) return [];
    // Add empty explanation (Python parser doesn't generate them)
    return parsed.map((q: Omit<ExtractedQuestion, "explanation">) => ({ ...q, explanation: "" }));
  } catch (err) {
    console.error("  Python parser error:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ─── Groq AI extractor ──────────────────────────────────────────────────────

let groq: Groq | null = null;
function getGroq(): Groq {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      console.error("ERROR: GROQ_API_KEY is not set (required for AI subjects).");
      process.exit(1);
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

function extractTextFromPdf(pdfPath: string): string {
  try {
    return execSync(`pdftotext "${pdfPath}" -`, { maxBuffer: 50 * 1024 * 1024 }).toString();
  } catch {
    console.error(`  Failed to extract text from ${pdfPath}`);
    return "";
  }
}

function splitIntoChunks(text: string, chunkSize = 3000): string[] {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + chunkSize, text.length);
    if (end < text.length) {
      const lookback = text.slice(Math.max(pos, end - 300), end);
      const boundary = lookback.search(/\n\d{1,3}[:.]\s/g);
      if (boundary !== -1) end = Math.max(pos, end - 300) + boundary;
    }
    chunks.push(text.slice(pos, end).trim());
    pos = end;
  }
  return chunks.filter((c) => c.length > 100);
}

async function extractQuestionsFromChunk(
  chunk: string,
  subjectName: string,
  hasLatex: boolean
): Promise<ExtractedQuestion[]> {
  const latexInstructions = hasLatex
    ? `
IMPORTANT — This is a math/science subject. When question text or options contain mathematical expressions:
- Use LaTeX inline math: $expression$ (e.g., $x^2 + 2x + 1$, $\\frac{a}{b}$)
- Use LaTeX display math: $$expression$$ for standalone equations
- Fix garbled symbols: "x2" likely means $x^2$, "1-V a 2T" means $\\frac{1-V}{a} = 2T$ etc.
- Reconstruct equations from context — the PDF extraction is messy for math.`
    : "";

  const prompt = `You are extracting JAMB (Nigerian university entrance exam) past questions for ${subjectName}.

The text below is raw output from pdftotext — it may be garbled, have broken formatting, or mix multiple columns. Extract EVERY complete multiple-choice question you can find.
${latexInstructions}

For each question:
1. Clean up the question text (fix OCR artifacts, remove page headers/URLs like "www.myschoolgist.com", "Download MySchoolGist...")
2. Extract all options (A, B, C, D — and E if present). Clean up option text too.
3. Identify the CORRECT answer. Use:
   - Any answer key present in the text (format like "1.D, 2.A, 3.B..." or similar)
   - Your own knowledge to VERIFY and CORRECT if needed
4. Write a concise explanation (2-3 sentences) confirming WHY the answer is correct.
5. Extract the year if mentioned (e.g., "Mathematics 1983", "UTME 2010").

SKIP:
- Incomplete questions (missing options)
- Non-question text (page numbers, headers, instructions)
- Duplicate questions

Return ONLY valid JSON — no markdown, no explanation outside the JSON:
[
  {
    "text": "cleaned question text",
    "year": 1983,
    "options": [
      {"label": "A", "text": "option text", "isCorrect": false},
      {"label": "B", "text": "option text", "isCorrect": true},
      {"label": "C", "text": "option text", "isCorrect": false},
      {"label": "D", "text": "option text", "isCorrect": false}
    ],
    "explanation": "B is correct because..."
  }
]

If no valid questions found, return: []

RAW TEXT:
${chunk}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await getGroq().chat.completions.create({
        model: "llama-3.1-8b-instant", // 30,000 TPM on free tier vs 6,000 for 70b
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: hasLatex ? 3000 : 4000, // LaTeX responses are larger; keep under 8b request limit
      });
      const raw = (result.choices[0].message.content ?? "").trim();
      const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (q) =>
          typeof q.text === "string" &&
          q.text.length > 10 &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          q.options.some((o: ExtractedQuestion["options"][0]) => o.isCorrect)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("429") || msg.includes("quota") || msg.includes("503") || msg.includes("overload");
      if (isRateLimit && attempt < 3) {
        const wait = attempt * 30000;
        process.stdout.write(` [rate limit, waiting ${wait / 1000}s]`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.error("  Error:", msg.slice(0, 120));
      return [];
    }
  }
  return [];
}

// ─── dedup hash ─────────────────────────────────────────────────────────────

function hashQuestion(subjectId: string, text: string): string {
  return crypto
    .createHash("sha256")
    .update(`${subjectId}::${text.trim().toLowerCase().slice(0, 200)}`)
    .digest("hex");
}

// ─── DB upsert ──────────────────────────────────────────────────────────────

function isDbConnectionError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = (err as { message?: string })?.message ?? "";
  return (
    code === "P1001" ||
    code === "P1002" ||
    msg.includes("Can't reach database") ||
    msg.includes("connection pool") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT")
  );
}

async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (isDbConnectionError(err) && i < retries) {
        const wait = i * 8000;
        process.stdout.write(` [db reconnect attempt ${i}, waiting ${wait / 1000}s]`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

/** Write a batch of questions in one transaction. Returns created/skipped counts. */
async function writeQuestions(
  subjectId: string,
  questions: ExtractedQuestion[]
): Promise<{ created: number; skipped: number }> {
  const hashes = questions.map((q) => hashQuestion(subjectId, q.text));

  // Find which hashes already exist in one query
  const existing = await prisma.question.findMany({
    where: { subjectId, sourceRef: { in: hashes } },
    select: { sourceRef: true },
  });
  const existingSet = new Set(existing.map((e) => e.sourceRef));

  const toCreate = questions
    .map((q, i) => ({ q, hash: hashes[i] }))
    .filter(({ hash }) => !existingSet.has(hash));
  const skipped = questions.length - toCreate.length;

  // Create all new questions in one transaction
  await prisma.$transaction(
    toCreate.map(({ q, hash }) =>
      prisma.question.create({
        data: {
          subjectId,
          text: q.text,
          year: q.year,
          sourceType: "IMPORTED",
          sourceRef: hash,
          isPublished: true,
          aiAssisted: true,
          options: {
            create: q.options.map((opt, idx) => ({
              label: opt.label,
              text: opt.text,
              isCorrect: opt.isCorrect,
              sortOrder: idx,
            })),
          },
          ...(q.explanation
            ? { explanation: { create: { text: q.explanation, aiAssisted: true } } }
            : {}),
        },
      })
    ),
    { timeout: 30000 }
  );

  return { created: toCreate.length, skipped };
}

// ─── per-subject seeder ─────────────────────────────────────────────────────

async function seedQuestionsForSubject(code: string) {
  const cfg = SUBJECTS[code];
  if (!cfg) { console.error(`Unknown subject code: ${code}`); return; }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Processing: ${code} — ${cfg.file} [${cfg.parser}]`);
  console.log(`${"─".repeat(60)}`);

  const subject = await prisma.subject.findUnique({ where: { code } });
  if (!subject) {
    console.error(`  Subject ${code} not found in DB. Run npm run db:seed first.`);
    return;
  }

  const pdfPath = path.join(PDF_DIR, cfg.file);

  // ── Python path (GOV, ECO, BIO, LIT) ─────────────────────────────────────
  if (cfg.parser === "python") {
    console.log("  Running Python parser...");
    const questions = extractQuestionsViaPython(pdfPath, code);
    console.log(`  Extracted ${questions.length} questions from PDF`);

    const { created, skipped } = await withRetry(() =>
      writeQuestions(subject.id, questions)
    );
    console.log(`  ✓ ${code} done — Created: ${created}, Skipped duplicates: ${skipped}`);
    return;
  }

  // ── Groq AI path (ENG, COM, ACC, CRK, MTH, CHM, PHY) ────────────────────
  console.log("  Extracting PDF text...");
  const text = extractTextFromPdf(pdfPath);
  if (!text) { console.error("  No text extracted."); return; }

  const chunks = splitIntoChunks(text, cfg.hasLatex ? 2000 : 3000);
  console.log(`  Split into ${chunks.length} chunks`);

  let totalCreated = 0, totalSkipped = 0;
  const BATCH = 3; // 3 parallel — safe with llama-3.1-8b-instant (30k TPM)

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    process.stdout.write(`  Chunks ${i + 1}–${Math.min(i + BATCH, chunks.length)}/${chunks.length}... `);

    const batchResults = await Promise.all(
      batch.map((chunk) => extractQuestionsFromChunk(chunk, subject.name, cfg.hasLatex))
    );
    const questions = batchResults.flat();
    process.stdout.write(`got ${questions.length} questions`);

    // Write all questions in one transaction to minimise round-trips / hanging
    if (questions.length > 0) {
      const { created, skipped } = await withRetry(() =>
        writeQuestions(subject.id, questions)
      );
      totalCreated += created;
      totalSkipped += skipped;
    }
    console.log(` (created: ${totalCreated}, skipped: ${totalSkipped})`);

    if (i + BATCH < chunks.length) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log(`\n  ✓ ${code} done — Created: ${totalCreated}, Skipped duplicates: ${totalSkipped}`);
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const targetCode = process.argv[2]?.toUpperCase();
  const codes = targetCode ? [targetCode] : Object.keys(SUBJECTS);

  console.log(`JAMB Questions Seeder`);
  console.log(`Subjects to process: ${codes.join(", ")}`);

  // Wake up Neon (cold starts can take several seconds)
  process.stdout.write("Connecting to database...");
  await withRetry(async () => {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  });
  console.log(" OK");

  for (const code of codes) {
    await seedQuestionsForSubject(code);
  }

  console.log("\n✓ All done.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
