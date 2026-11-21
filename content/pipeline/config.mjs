// Pipeline configuration: models, prices, budget, sources.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PIPELINE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(PIPELINE_DIR, '..', '..');
export const STATE_DIR = path.join(PIPELINE_DIR, 'state');
export const DIST_DIR = path.join(PIPELINE_DIR, 'dist');

// Sonnet does the volume work (extract, solve+explain, generate); Opus is the judge on disagreements.
export const MODELS = {
  worker: 'claude-sonnet-5-5',
  judge: 'claude-opus-5-5',
};

// Standard $/1M tokens. Batch API bills 50% of these; cache writes 1.25x input, cache reads as listed.
export const PRICES = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
};
export const BATCH_DISCOUNT = 0.5;

// Hard cap on total spend across every run (the ledger in state/spend.json persists between runs).
// $25 of credit minus a $1 reserve for re-runs.
export const DEFAULT_BUDGET_USD = 24;

// Questions with no printed answer (most of the PDF booklets):
//   'sonnet-unless-low' → accept Sonnet's answer unless Sonnet itself rated it low-confidence (those go to Opus)
//   'sonnet'            → always accept Sonnet's answer
//   'opus'              → send every keyless question to Opus (most accurate, ~$0.003/question)
// AI-generated questions always go to Opus regardless. Override per run with --keyless <policy>.
// 'opus': correctness over cost (user decision, 2026-11-21).
export const KEYLESS_POLICY = 'opus';

// Reasoning effort (user choice: low/medium). Opus reviews at medium. Sonnet uses medium where the
// explanation is a calculation students must be able to follow, low for recall/comprehension subjects
// (every booklet/Sonnet disagreement and every keyless question still goes to Opus).
export const VERIFY_EFFORT = 'medium';
export const SOLVE_EFFORT_MEDIUM = new Set(['MTH', 'PHY', 'CHM', 'ACC', 'ECO']);

// Request sizing.
export const PDF_PAGES_PER_CHUNK = 4; // pages sent per extraction request
export const PDF_CHUNK_STRIDE = 3; // 1-page overlap so a question split across chunks is whole in one of them
export const SOLVE_PER_REQUEST = 15;
export const VERIFY_PER_REQUEST = 10;
export const GENERATE_PER_REQUEST = 10;

// Rough output-token estimates per unit, used only for the pre-submit budget check (the ledger uses real usage).
export const EST_OUTPUT_TOKENS = { extractPage: 2500, solve: 350, verify: 700, generate: 450 };
export const EST_INPUT_TOKENS = { pdfPage: 2200 };

// JAMB past-question PDFs → subject code.
export const PDF_SOURCES = [
  { file: 'question_pdfs/Use-of-English-JAMB-Past-Questions-And-Answers.pdf', subject: 'ENG' },
  // Replaces jamb_mathematics*.json: same papers, but with figures and printed keys (the JSON lost both,
  // and a third of its rows were unusable).
  { file: 'question_pdfs/MATHEMATICS-JAMB-Past-Questions.pdf', subject: 'MTH' },
  { file: 'question_pdfs/JAMB-Biology-Past-Questions-and-Answers.pdf', subject: 'BIO' },
  { file: 'question_pdfs/CHEMISTRY-JAMB-Past-Questions.pdf', subject: 'CHM' },
  { file: 'question_pdfs/Physics-JAMB-Past-Questions.pdf', subject: 'PHY' },
  { file: 'question_pdfs/JAMB-Economics-Past-Questions-and-Answers.pdf', subject: 'ECO' },
  { file: 'question_pdfs/Government-JAMB-Past-Questions-And-Answers.pdf', subject: 'GOV' },
  { file: 'question_pdfs/Literature-In-English-JAMB-Past-Questions-and-Answers.pdf', subject: 'LIT' },
  { file: 'question_pdfs/CRK-JAMB-Past-Questions.pdf', subject: 'CRK' },
  { file: 'question_pdfs/COMMERCE-JAMB-Past-Questions.pdf', subject: 'COM' },
  { file: 'question_pdfs/Principles-of-Accounts-JAMB-Past-Questions.pdf', subject: 'ACC' },
];

// Structured JSON sources already in the repo.
//   format:     'import' = optionA–D rows, 'options' = options[] with isCorrect
//   examType:   JAMB unless the file is Post-UTME material
//   sourceType: AI_ASSISTED for files that are predictions/generated, never real papers
//   keepYear:   false drops the year (a "2026" prediction is not a past paper)
export const JSON_SOURCES = [
  // Old text extraction of the Maths PDF: figures lost, a third unusable. The PDF is extracted instead.
  { file: 'jamb_mathematics_fixed.json', format: 'import', examType: 'JAMB', supersededBy: 'the Maths PDF' },
  { file: 'jamb_mathematics.json', format: 'import', examType: 'JAMB', supersededBy: 'the Maths PDF' },
  { file: 'question-bank/batch1-output-repaired.json', format: 'import', examType: 'POST_UTME' },
  { file: 'question-bank/flagged-questions.json', format: 'options', examType: 'JAMB' },
  { file: 'question-bank/mock-test-questions.json', format: 'options', examType: 'JAMB', postUtmeSubjects: ['General Paper'] },
  { file: 'question-bank/government.json', format: 'options', examType: 'JAMB' },
  { file: 'question-bank/economics.json', format: 'options', examType: 'JAMB' },
  { file: 'question-bank/geography.json', format: 'options', examType: 'JAMB' },
  { file: 'question-bank/unilag_gen_knowledge.json', format: 'import', examType: 'POST_UTME', school: 'UNILAG', sourceType: 'AI_ASSISTED', keepYear: false },
  { file: 'question-bank/unilag-maths-2026.json', format: 'import', examType: 'POST_UTME', school: 'UNILAG', sourceType: 'AI_ASSISTED', keepYear: false },
  // Broken PDF-parse rows from the old DB. The same subjects are re-extracted from the PDFs, so off by default.
  { file: 'question-bank/invalid-questions.json', format: 'options', examType: 'JAMB', enabled: false },
];
