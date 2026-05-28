#!/usr/bin/env node
/**
 * seed-questions.js
 * Inserts extracted questions directly into the DB via Prisma — no HTTP limit.
 *
 * Usage:
 *   node seed-questions.js <questions.json> <school> <examType>
 *
 * examType: JAMB | WAEC | POST_UTME
 */

const fs                = require('fs');
const path              = require('path');
const { randomUUID }    = require('crypto');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require(require('path').join(__dirname, 'acadmate-api/node_modules/@prisma/client'));

const BATCH_SIZE = 100;

const prisma = new PrismaClient();

async function main() {
  const [,, jsonFile, school, examType] = process.argv;

  if (!jsonFile || !school || !examType) {
    console.error('Usage: node seed-questions.js <questions.json> <school> <examType>');
    console.error('  examType: JAMB | WAEC | POST_UTME');
    process.exit(1);
  }

  if (!['JAMB', 'WAEC', 'POST_UTME'].includes(examType)) {
    console.error(`Invalid examType "${examType}". Must be JAMB, WAEC, or POST_UTME.`);
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(jsonFile, 'utf8').replace(/^﻿/, ''));
  console.log(`\nLoaded   : ${questions.length} questions`);
  console.log(`School   : ${school}  |  ExamType : ${examType}\n`);

  // ── Step 1: resolve all subjects & topics sequentially (fills cache, no races)
  const subjectCache = new Map(); // name.lower → id
  const topicCache   = new Map(); // subjectId:name.lower → id

  async function getSubjectId(name) {
    const key = name.trim().toLowerCase();
    if (subjectCache.has(key)) return subjectCache.get(key);
    const norm    = name.trim();
    let subject   = await prisma.subject.findFirst({ where: { name: { equals: norm, mode: 'insensitive' } }, select: { id: true } });
    if (!subject) {
      const code  = norm.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 8) + '_' + Date.now().toString(36);
      subject     = await prisma.subject.create({ data: { name: norm, code, isActive: true }, select: { id: true } });
      console.log(`  [new subject] ${norm}`);
    }
    subjectCache.set(key, subject.id);
    return subject.id;
  }

  async function getTopicId(subjectId, name) {
    const key  = `${subjectId}:${name.trim().toLowerCase()}`;
    if (topicCache.has(key)) return topicCache.get(key);
    const norm  = name.trim();
    let topic   = await prisma.topic.findFirst({ where: { subjectId, name: { equals: norm, mode: 'insensitive' } }, select: { id: true } });
    if (!topic) {
      topic = await prisma.topic.create({ data: { subjectId, name: norm, isActive: true }, select: { id: true } });
    }
    topicCache.set(key, topic.id);
    return topic.id;
  }

  process.stdout.write('Resolving subjects & topics… ');
  for (const q of questions) {
    const subjectId = await getSubjectId(q.subject || 'General Knowledge');
    if (q.topic) await getTopicId(subjectId, q.topic);
  }
  console.log('done\n');

  // ── Step 2: build all rows with client-generated IDs ─────────────────────────
  const VALID_DIFFICULTY = new Set(['EASY', 'MEDIUM', 'HARD']);

  const questionRows     = [];
  const optionRows       = [];
  const explanationRows  = [];

  for (const q of questions) {
    const subjectKey = (q.subject || 'General Knowledge').trim().toLowerCase();
    const subjectId  = subjectCache.get(subjectKey);
    const topicKey   = q.topic ? `${subjectId}:${q.topic.trim().toLowerCase()}` : null;
    const topicId    = topicKey ? (topicCache.get(topicKey) ?? null) : null;
    const qId        = randomUUID();

    questionRows.push({
      id:          qId,
      subjectId,
      topicId,
      text:        q.text,
      year:        q.year  ? Number(q.year)  : null,
      school,
      examType,
      difficulty:  VALID_DIFFICULTY.has(q.difficulty) ? q.difficulty : 'MEDIUM',
      sourceType:  'IMPORTED',
      aiAssisted:  true,
      isPublished: true,
    });

    if (q.correctOption === null) {
      console.warn(`  [no answer] question skipped (correctOption is null): "${String(q.text).slice(0, 80)}"`);
    }

    ['A', 'B', 'C', 'D'].forEach((l, idx) => {
      if (!q[`option${l}`]) return;
      optionRows.push({
        id:         randomUUID(),
        questionId: qId,
        label:      l,
        text:       String(q[`option${l}`]),
        isCorrect:  q.correctOption === l,
        sortOrder:  idx,
      });
    });

    if (q.explanation) {
      explanationRows.push({
        id:         randomUUID(),
        questionId: qId,
        text:       String(q.explanation),
        aiAssisted: true,
        reviewed:   false,
      });
    }
  }

  // ── Step 3: insert in batches (3 createMany calls per batch) ─────────────────
  const totalBatches = Math.ceil(questionRows.length / BATCH_SIZE);
  let inserted = 0;

  for (let i = 0; i < questionRows.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} … `);

    const qBatch   = questionRows.slice(i, i + BATCH_SIZE);
    const qIds     = new Set(qBatch.map(r => r.id));
    const oBatch   = optionRows.filter(r => qIds.has(r.questionId));
    const eBatch   = explanationRows.filter(r => qIds.has(r.questionId));

    await prisma.$transaction([
      prisma.question.createMany({ data: qBatch, skipDuplicates: true }),
      prisma.questionOption.createMany({ data: oBatch, skipDuplicates: true }),
      ...(eBatch.length ? [prisma.explanation.createMany({ data: eBatch, skipDuplicates: true })] : []),
    ]);

    inserted += qBatch.length;
    console.log(`done  (${inserted}/${questionRows.length})`);
  }

  console.log(`\nFinished. ${inserted} questions inserted into the database.\n`);
}

main()
  .catch(err => {
    console.error('\nFatal error:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
