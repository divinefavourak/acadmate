/**
 * Seed: 10 published POST_UTME questions for UNILAG (2023).
 * Spread across Use of English, Mathematics, and Biology.
 *
 * Run:  npx ts-node prisma/seed.ts
 */

import { PrismaClient, ExamType, Difficulty } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Subject IDs (from live DB) ───────────────────────────────────────────────
const SUBJECT = {
  ENG: 'cmnwk5x1a0001lirk6segnsfn',
  MTH: 'cmnwk5zj90002lirklplxc99x',
  BIO: 'cmnwk621b0003lirkco4ltll0',
};

const SCHOOL = 'UNILAG';
const YEAR   = 2023;

// ─── Question bank ────────────────────────────────────────────────────────────

const questions: Array<{
  subjectId: string;
  text: string;
  difficulty: Difficulty;
  options: { label: string; text: string; isCorrect: boolean }[];
}> = [
  // ── Use of English (4 questions) ──────────────────────────────────────────
  {
    subjectId: SUBJECT.ENG,
    difficulty: Difficulty.MEDIUM,
    text: 'Choose the option that best explains the information conveyed in the sentence.\n\n"The lecturer was in the middle of his lecture when the power went out."',
    options: [
      { label: 'A', text: 'The lecturer completed his lecture before the power went out.', isCorrect: false },
      { label: 'B', text: 'The power went out while the lecturer was still speaking.', isCorrect: true },
      { label: 'C', text: 'The lecturer stopped speaking because of a power outage.', isCorrect: false },
      { label: 'D', text: 'The power outage prevented the lecture from starting.', isCorrect: false },
    ],
  },
  {
    subjectId: SUBJECT.ENG,
    difficulty: Difficulty.EASY,
    text: 'Choose the option nearest in meaning to the underlined word.\n\nThe politician\'s speech was filled with __ambiguous__ statements.',
    options: [
      { label: 'A', text: 'clear', isCorrect: false },
      { label: 'B', text: 'vague', isCorrect: true },
      { label: 'C', text: 'concise', isCorrect: false },
      { label: 'D', text: 'confident', isCorrect: false },
    ],
  },
  {
    subjectId: SUBJECT.ENG,
    difficulty: Difficulty.MEDIUM,
    text: 'Select the option that correctly fills the gap in the sentence.\n\nNeither the students nor the teacher _____ arrived at the venue.',
    options: [
      { label: 'A', text: 'have', isCorrect: false },
      { label: 'B', text: 'has', isCorrect: true },
      { label: 'C', text: 'had', isCorrect: false },
      { label: 'D', text: 'having', isCorrect: false },
    ],
  },
  {
    subjectId: SUBJECT.ENG,
    difficulty: Difficulty.HARD,
    text: 'Identify the sentence that contains a dangling modifier.',
    options: [
      { label: 'A', text: 'Running quickly, the bus was caught by Emeka.', isCorrect: true },
      { label: 'B', text: 'She painted the wall carefully.', isCorrect: false },
      { label: 'C', text: 'The dog barked at the stranger who approached.', isCorrect: false },
      { label: 'D', text: 'Having finished the exam, the students left the hall.', isCorrect: false },
    ],
  },

  // ── Mathematics (3 questions) ─────────────────────────────────────────────
  {
    subjectId: SUBJECT.MTH,
    difficulty: Difficulty.MEDIUM,
    text: 'If 3x − 7 = 2, find the value of x.',
    options: [
      { label: 'A', text: '1', isCorrect: false },
      { label: 'B', text: '2', isCorrect: false },
      { label: 'C', text: '3', isCorrect: true },
      { label: 'D', text: '4', isCorrect: false },
    ],
  },
  {
    subjectId: SUBJECT.MTH,
    difficulty: Difficulty.HARD,
    text: 'A bag contains 5 red balls and 3 blue balls. Two balls are drawn at random without replacement. What is the probability that both balls are red?',
    options: [
      { label: 'A', text: '5/14', isCorrect: true },
      { label: 'B', text: '25/64', isCorrect: false },
      { label: 'C', text: '10/28', isCorrect: false },
      { label: 'D', text: '1/4', isCorrect: false },
    ],
  },
  {
    subjectId: SUBJECT.MTH,
    difficulty: Difficulty.EASY,
    text: 'Simplify: log₁₀ 1000',
    options: [
      { label: 'A', text: '2', isCorrect: false },
      { label: 'B', text: '3', isCorrect: true },
      { label: 'C', text: '4', isCorrect: false },
      { label: 'D', text: '10', isCorrect: false },
    ],
  },

  // ── Biology (3 questions) ─────────────────────────────────────────────────
  {
    subjectId: SUBJECT.BIO,
    difficulty: Difficulty.EASY,
    text: 'Which of the following is the site of photosynthesis in a plant cell?',
    options: [
      { label: 'A', text: 'Mitochondria', isCorrect: false },
      { label: 'B', text: 'Nucleus', isCorrect: false },
      { label: 'C', text: 'Chloroplast', isCorrect: true },
      { label: 'D', text: 'Ribosome', isCorrect: false },
    ],
  },
  {
    subjectId: SUBJECT.BIO,
    difficulty: Difficulty.MEDIUM,
    text: 'The process by which water moves from a region of higher water potential to a region of lower water potential across a semi-permeable membrane is called',
    options: [
      { label: 'A', text: 'Active transport', isCorrect: false },
      { label: 'B', text: 'Diffusion', isCorrect: false },
      { label: 'C', text: 'Osmosis', isCorrect: true },
      { label: 'D', text: 'Plasmolysis', isCorrect: false },
    ],
  },
  {
    subjectId: SUBJECT.BIO,
    difficulty: Difficulty.HARD,
    text: 'In a cross between a homozygous tall plant (TT) and a homozygous short plant (tt), what percentage of the F₂ offspring are expected to be phenotypically tall?',
    options: [
      { label: 'A', text: '25%', isCorrect: false },
      { label: 'B', text: '50%', isCorrect: false },
      { label: 'C', text: '75%', isCorrect: true },
      { label: 'D', text: '100%', isCorrect: false },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${questions.length} POST_UTME questions for ${SCHOOL} (${YEAR})…`);

  for (const [i, q] of questions.entries()) {
    const created = await prisma.question.create({
      data: {
        subjectId: q.subjectId,
        text: q.text,
        difficulty: q.difficulty,
        school: SCHOOL,
        examType: ExamType.POST_UTME,
        year: YEAR,
        isPublished: true,
        sourceType: 'MANUAL',
        options: {
          create: q.options.map((o, idx) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.isCorrect,
            sortOrder: idx,
          })),
        },
      },
      select: { id: true },
    });
    console.log(`  [${i + 1}/${questions.length}] Created ${created.id}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
