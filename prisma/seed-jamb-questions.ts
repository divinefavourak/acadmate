/**
 * JAMB Past Questions Seeder
 * Extracts questions from PDF files using Claude API, confirms answers, adds explanations.
 *
 * Usage:
 *   Set DATABASE_URL and ANTHROPIC_API_KEY in your terminal, then:
 *   npx tsx prisma/seed-jamb-questions.ts [SUBJECT_CODE]
 *
 *   SUBJECT_CODE is optional — omit to process all subjects.
 *   Examples: ENG, MTH, BIO, CHM, PHY, GOV, ECO, LIT, COM, ACC, CRK
 */

import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import * as path from "path";
import * as crypto from "crypto";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PDF_DIR = path.join(process.cwd(), "question_pdfs");

const SUBJECTS: Record<string, { file: string; hasLatex: boolean }> = {
  ENG: { file: "Use-of-English-JAMB-Past-Questions-And-Answers.pdf", hasLatex: false },
  MTH: { file: "MATHEMATICS-JAMB-Past-Questions.pdf", hasLatex: true },
  BIO: { file: "JAMB-Biology-Past-Questions-and-Answers.pdf", hasLatex: false },
  CHM: { file: "CHEMISTRY-JAMB-Past-Questions.pdf", hasLatex: true },
  PHY: { file: "Physics-JAMB-Past-Questions.pdf", hasLatex: true },
  GOV: { file: "Government-JAMB-Past-Questions-And-Answers.pdf", hasLatex: false },
  ECO: { file: "JAMB-Economics-Past-Questions-and-Answers.pdf", hasLatex: false },
  LIT: { file: "Literature-In-English-JAMB-Past-Questions-and-Answers.pdf", hasLatex: false },
  COM: { file: "COMMERCE-JAMB-Past-Questions.pdf", hasLatex: false },
  ACC: { file: "Principles-of-Accounts-JAMB-Past-Questions.pdf", hasLatex: false },
  CRK: { file: "CRK-JAMB-Past-Questions.pdf", hasLatex: false },
};

type ExtractedQuestion = {
  text: string;
  year: number | null;
  options: { label: string; text: string; isCorrect: boolean }[];
  explanation: string;
};

function extractTextFromPdf(pdfPath: string): string {
  try {
    return execSync(`pdftotext "${pdfPath}" -`, { maxBuffer: 50 * 1024 * 1024 }).toString();
  } catch {
    console.error(`  Failed to extract text from ${pdfPath}`);
    return "";
  }
}

function splitIntoChunks(text: string, chunkSize = 4000): string[] {
  const chunks: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    let end = Math.min(pos + chunkSize, text.length);

    // Try to split at a blank line or question number boundary to avoid cutting mid-question
    if (end < text.length) {
      const lookback = text.slice(Math.max(pos, end - 300), end);
      // Find last occurrence of a question-start pattern (\n\d+[:.] or \n\d+\.)
      const boundary = lookback.search(/\n\d{1,3}[:.]\s/g);
      if (boundary !== -1) {
        end = Math.max(pos, end - 300) + boundary;
      }
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

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") return [];

    const raw = content.text.trim();
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    // Validate structure
    return parsed.filter(
      (q) =>
        typeof q.text === "string" &&
        q.text.length > 10 &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.some((o: ExtractedQuestion["options"][0]) => o.isCorrect)
    );
  } catch (err) {
    console.error("  JSON parse error:", err instanceof Error ? err.message : err);
    return [];
  }
}

function hashQuestion(subjectId: string, text: string): string {
  return crypto
    .createHash("sha256")
    .update(`${subjectId}::${text.trim().toLowerCase().slice(0, 200)}`)
    .digest("hex");
}

async function seedQuestionsForSubject(code: string) {
  const cfg = SUBJECTS[code];
  if (!cfg) { console.error(`Unknown subject code: ${code}`); return; }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Processing: ${code} — ${cfg.file}`);
  console.log(`${"─".repeat(60)}`);

  // Get subject from DB
  const subject = await prisma.subject.findUnique({ where: { code } });
  if (!subject) {
    console.error(`  Subject ${code} not found in DB. Run npm run db:seed first.`);
    return;
  }

  const pdfPath = path.join(PDF_DIR, cfg.file);
  console.log("  Extracting PDF text...");
  const text = extractTextFromPdf(pdfPath);
  if (!text) { console.error("  No text extracted."); return; }

  const chunks = splitIntoChunks(text);
  console.log(`  Split into ${chunks.length} chunks`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  Chunk ${i + 1}/${chunks.length}... `);

    const questions = await extractQuestionsFromChunk(chunks[i], subject.name, cfg.hasLatex);
    process.stdout.write(`got ${questions.length} questions`);

    for (const q of questions) {
      const hash = hashQuestion(subject.id, q.text);

      // Check for duplicate by hash stored in sourceRef
      const existing = await prisma.question.findFirst({
        where: { subjectId: subject.id, sourceRef: hash },
      });

      if (existing) {
        totalSkipped++;
        continue;
      }

      await prisma.question.create({
        data: {
          subjectId: subject.id,
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
            ? {
                explanation: {
                  create: {
                    text: q.explanation,
                    aiAssisted: true,
                  },
                },
              }
            : {}),
        },
      });
      totalCreated++;
    }

    console.log(` (created: ${totalCreated}, skipped: ${totalSkipped})`);

    // Rate limit: 1s between API calls
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n  ✓ ${code} done — Created: ${totalCreated}, Skipped duplicates: ${totalSkipped}`);
}

async function main() {
  const targetCode = process.argv[2]?.toUpperCase();
  const codes = targetCode ? [targetCode] : Object.keys(SUBJECTS);

  console.log(`JAMB Questions Seeder`);
  console.log(`Subjects to process: ${codes.join(", ")}`);

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
