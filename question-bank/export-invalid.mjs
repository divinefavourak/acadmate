/**
 * export-invalid.mjs
 * Exports questions with validation issues (no correct answer, empty option text,
 * or fewer than 4 options) — the same format as flagged-questions.json so
 * correct-flagged.mjs can process them.
 *
 * Usage (local):     node question-bank/export-invalid.mjs
 * Usage (container): docker exec acadmate-api-1 node /app/export-invalid.mjs
 */

import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { writeFileSync, existsSync } from 'fs';

const inContainer = existsSync('/app/node_modules/@prisma/client');
const require = createRequire(import.meta.url);
const { PrismaClient } = inContainer
  ? require('/app/node_modules/@prisma/client')
  : require('../acadmate-api/node_modules/@prisma/client');

if (!inContainer) {
  const { config } = await import('dotenv');
  config({ path: fileURLToPath(new URL('../acadmate-api/.env', import.meta.url)) });
}

const prisma = new PrismaClient();

const include = {
  subject:  { select: { id: true, name: true } },
  topic:    { select: { id: true, name: true } },
  options:  { orderBy: { sortOrder: 'asc' } },
  explanation: true,
};

// ── 1. No correct answer ───────────────────────────────────────────────────────
const noAnswer = await prisma.question.findMany({
  where: { options: { none: { isCorrect: true } } },
  include,
  orderBy: { createdAt: 'asc' },
});

// ── 2. More than 4 options ─────────────────────────────────────────────────────
const tooManyOptions = await prisma.question.findMany({
  where: { options: { some: {} } },
  include,
  orderBy: { createdAt: 'asc' },
});
const moreThan4 = tooManyOptions.filter(q => q.options.length > 4);

// ── 3. Any option with empty text ──────────────────────────────────────────────
const emptyOptionQuestions = await prisma.question.findMany({
  where: { options: { some: { text: '' } } },
  include,
  orderBy: { createdAt: 'asc' },
});

// ── Merge & deduplicate ────────────────────────────────────────────────────────
const seen = new Set();
const all = [...noAnswer, ...moreThan4, ...emptyOptionQuestions].filter(q => {
  if (seen.has(q.id)) return false;
  seen.add(q.id);
  return true;
});

// ── Format (same shape as flagged-questions.json) ─────────────────────────────
const output = all.map(q => {
  const issues = [];
  if (!q.options.some(o => o.isCorrect))   issues.push('no-correct-answer');
  if (q.options.length > 4)                issues.push('too-many-options');
  if (q.options.some(o => o.text === ''))  issues.push('empty-option');

  return {
    id:        q.id,
    subject:   q.subject.name,
    subjectId: q.subjectId,
    topic:     q.topic?.name ?? null,
    topicId:   q.topicId ?? null,
    year:      q.year,
    school:    q.school,
    examType:  q.examType,
    difficulty: q.difficulty,
    flagCount:  q.flagCount,
    issues,                     // extra field so you know why it was pulled
    text:      q.text,
    imageUrl:  q.imageUrl ?? null,
    options: q.options.map(o => ({
      id:        o.id,
      label:     o.label,
      text:      o.text,
      isCorrect: o.isCorrect,
    })),
    explanation:          q.explanation?.text ?? null,
    correctedText:        null,
    correctedOptions:     null,
    correctedExplanation: null,
    action: 'keep',
  };
});

const outFile = inContainer ? '/app/invalid-questions.json' : fileURLToPath(new URL('invalid-questions.json', import.meta.url));
writeFileSync(outFile, JSON.stringify(output, null, 2));

console.log(`\nExported ${output.length} invalid questions → ${outFile}`);
console.log(`  no-correct-answer : ${noAnswer.length}`);
console.log(`  too-many-options  : ${moreThan4.length}`);
console.log(`  empty-option-text : ${emptyOptionQuestions.length}`);

await prisma.$disconnect();
