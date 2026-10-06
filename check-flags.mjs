/**
 * check-flags.mjs
 * Shows a breakdown of flagged questions so we know what we're dealing with.
 * Usage: docker exec acadmate-api-1 node /app/check-flags.mjs
 */

import { createRequire } from 'module';
import { existsSync } from 'fs';

const inContainer = existsSync('/app/node_modules/@prisma/client');
const require = createRequire(import.meta.url);
const { PrismaClient } = inContainer
  ? require('/app/node_modules/@prisma/client')
  : require('./acadmate-api/node_modules/@prisma/client');

if (!inContainer) {
  const { config } = await import('dotenv');
  config({ path: './acadmate-api/.env' });
}

const prisma = new PrismaClient();

const total = await prisma.question.count({ where: { isFlagged: true } });

const byFlagCount = await prisma.question.groupBy({
  by: ['flagCount'],
  where: { isFlagged: true },
  _count: true,
  orderBy: { flagCount: 'asc' },
});

const bySubject = await prisma.question.groupBy({
  by: ['subjectId'],
  where: { isFlagged: true },
  _count: true,
});

const subjects = await prisma.subject.findMany({
  where: { id: { in: bySubject.map(r => r.subjectId) } },
  select: { id: true, name: true },
});
const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));

console.log(`\nTotal flagged: ${total}\n`);

console.log('── By flagCount ──────────────────────');
for (const row of byFlagCount) {
  const bar = '█'.repeat(Math.min(row._count, 40));
  console.log(`  flagCount=${row.flagCount}: ${String(row._count).padStart(4)}  ${bar}`);
}

console.log('\n── By subject ────────────────────────');
for (const row of bySubject.sort((a, b) => b._count - a._count)) {
  console.log(`  ${String(row._count).padStart(4)}  ${subjectMap[row.subjectId] ?? row.subjectId}`);
}

await prisma.$disconnect();
