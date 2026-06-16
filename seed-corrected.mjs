/**
 * seed-corrected.mjs
 * Reads flagged-questions.json (after agent correction) and applies fixes to the DB.
 *
 * Per question, the agent should have set:
 *   action: 'keep'   — unflag, no other changes
 *   action: 'fix'    — apply correctedText / correctedOptions / correctedExplanation
 *   action: 'delete' — delete the question entirely
 *
 * Usage: node seed-corrected.mjs
 */

import { PrismaClient } from './acadmate-api/node_modules/@prisma/client/index.js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: './acadmate-api/.env' });

const prisma = new PrismaClient();
const questions = JSON.parse(readFileSync('flagged-questions.json', 'utf-8'));

let kept = 0, fixed = 0, deleted = 0, skipped = 0;

for (const q of questions) {
  if (q.action === 'delete') {
    await prisma.question.delete({ where: { id: q.id } });
    deleted++;
    continue;
  }

  if (q.action === 'fix') {
    await prisma.$transaction(async tx => {
      await tx.question.update({
        where: { id: q.id },
        data: {
          text:       q.correctedText      ?? q.text,
          isFlagged:  false,
          flagCount:  0,
          reviewedAt: new Date(),
        },
      });

      if (q.correctedOptions) {
        for (const opt of q.correctedOptions) {
          await tx.questionOption.update({
            where: { id: opt.id },
            data:  { text: opt.text, isCorrect: opt.isCorrect },
          });
        }
      }

      if (q.correctedExplanation) {
        await tx.explanation.upsert({
          where:  { questionId: q.id },
          update: { text: q.correctedExplanation },
          create: { questionId: q.id, text: q.correctedExplanation, aiAssisted: true },
        });
      }

      // Resolve all open flags
      await tx.questionFlag.updateMany({
        where: { questionId: q.id, resolved: false },
        data:  { resolved: true, resolvedAt: new Date() },
      });
    });
    fixed++;
    continue;
  }

  if (q.action === 'keep') {
    await prisma.question.update({
      where: { id: q.id },
      data:  { isFlagged: false, flagCount: 0, reviewedAt: new Date() },
    });
    await prisma.questionFlag.updateMany({
      where: { questionId: q.id, resolved: false },
      data:  { resolved: true, resolvedAt: new Date() },
    });
    kept++;
    continue;
  }

  console.warn(`Skipped ${q.id} — unknown action "${q.action}"`);
  skipped++;
}

console.log(`Done. fixed=${fixed}  kept=${kept}  deleted=${deleted}  skipped=${skipped}`);
await prisma.$disconnect();
