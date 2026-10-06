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

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { config } from 'dotenv';

const inContainer = existsSync('/app/node_modules/@prisma/client');
const require = createRequire(import.meta.url);
const { PrismaClient } = inContainer
  ? require('/app/node_modules/@prisma/client')
  : require('./acadmate-api/node_modules/@prisma/client');

if (!inContainer) config({ path: './acadmate-api/.env' });

const arg = process.argv[2];
const dataFile = arg ?? (inContainer ? '/app/flagged-questions.json' : './flagged-questions.json');

const prisma = new PrismaClient();
const questions = JSON.parse(readFileSync(dataFile, 'utf-8'));

let kept = 0, fixed = 0, deleted = 0, skipped = 0;

for (const q of questions) {
  if (q.action === 'delete') {
    await prisma.$transaction(async tx => {
      await tx.examSessionQuestion.deleteMany({ where: { questionId: q.id } });
      await tx.userAnswer.deleteMany({ where: { questionId: q.id } });
      await tx.questionFlag.deleteMany({ where: { questionId: q.id } });
      await tx.explanation.deleteMany({ where: { questionId: q.id } });
      await tx.questionOption.deleteMany({ where: { questionId: q.id } });
      await tx.question.delete({ where: { id: q.id } });
    });
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
        const realOpts = q.correctedOptions.filter(o => !o.id.startsWith('generated_'));
        const newOpts  = q.correctedOptions.filter(o =>  o.id.startsWith('generated_'));

        // Delete options not in correctedOptions (handles merged questions trimmed to 4 options)
        if (realOpts.length > 0) {
          await tx.questionOption.deleteMany({
            where: { questionId: q.id, id: { notIn: realOpts.map(o => o.id) } },
          });
        }
        for (const opt of realOpts) {
          await tx.questionOption.update({
            where: { id: opt.id },
            data:  { text: opt.text, isCorrect: opt.isCorrect },
          });
        }
        // Create brand-new options for those the agent generated (reconstructed missing options)
        for (const [idx, opt] of newOpts.entries()) {
          await tx.questionOption.create({
            data: {
              questionId: q.id,
              label:      opt.label,
              text:       opt.text,
              isCorrect:  opt.isCorrect,
              sortOrder:  100 + idx,
            },
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
