/**
 * export-flagged.mjs
 * Pulls all flagged questions from the DB and saves them to flagged-questions.json.
 * Pass that file to an agent to correct, then run seed-corrected.mjs to write back.
 *
 * Usage: node export-flagged.mjs
 */

// Supports running from project root (local) or inside the Docker container (/app)
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { config } from 'dotenv';

const inContainer = existsSync('/app/node_modules/@prisma/client');
const require = createRequire(import.meta.url);
const { PrismaClient } = inContainer
  ? require('/app/node_modules/@prisma/client')
  : require('./acadmate-api/node_modules/@prisma/client');

if (!inContainer) config({ path: './acadmate-api/.env' });

const prisma = new PrismaClient();

const questions = await prisma.question.findMany({
  where: { isFlagged: true },
  include: {
    subject: { select: { id: true, name: true } },
    topic:   { select: { id: true, name: true } },
    options: { orderBy: { sortOrder: 'asc' } },
    explanation: true,
    questionFlags: {
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    },
  },
  orderBy: { flagCount: 'desc' },
});

const output = questions.map(q => ({
  id:          q.id,
  subject:     q.subject.name,
  subjectId:   q.subjectId,
  topic:       q.topic?.name ?? null,
  topicId:     q.topicId ?? null,
  year:        q.year,
  school:      q.school,
  examType:    q.examType,
  difficulty:  q.difficulty,
  flagCount:   q.flagCount,
  text:        q.text,
  imageUrl:    q.imageUrl ?? null,
  options: q.options.map(o => ({
    id:        o.id,
    label:     o.label,
    text:      o.text,
    isCorrect: o.isCorrect,
  })),
  explanation: q.explanation?.text ?? null,
  // Fields the agent should fill in after correcting:
  correctedText:        null,
  correctedOptions:     null,  // array of { label, text, isCorrect }
  correctedExplanation: null,
  action: 'keep',              // 'keep' | 'fix' | 'delete'
}));

writeFileSync('flagged-questions.json', JSON.stringify(output, null, 2));
console.log(`Exported ${output.length} flagged questions → flagged-questions.json`);

await prisma.$disconnect();
