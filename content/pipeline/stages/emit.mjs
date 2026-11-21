// Stage: emit (local, free). Accepted rows → import-ready JSON for /admin/imports, one file per exam/school/subject.
// Rows that need a human (missing or unreadable figure) are emitted too, as flagged drafts in their own file.
import fs from 'node:fs';
import path from 'node:path';
import { DIST_DIR } from '../config.mjs';
import { loadRows } from '../lib/state.mjs';
import { LETTERS } from '../lib/util.mjs';
import { SUBJECTS } from '../syllabus.mjs';

/** The importer takes exactly 4 options. Older JAMB papers have 5: drop the last option that isn't the answer. */
function fourOptions(options, answer) {
  if (options.length === 4) return { options, answer };
  if (options.length !== 5) return null;
  const drop = [4, 3, 2, 1, 0].find((i) => LETTERS[i] !== answer);
  const kept = options.filter((_, i) => i !== drop);
  const answerText = options[LETTERS.indexOf(answer)];
  return { options: kept, answer: LETTERS[kept.indexOf(answerText)] };
}

function toImportRow(r, answer, flagged) {
  const four = fourOptions(r.options, answer);
  if (!four) return null;
  return {
    subject: r.subject,
    topic: r.topic ?? undefined,
    text: r.text,
    optionA: four.options[0],
    optionB: four.options[1],
    optionC: four.options[2],
    optionD: four.options[3],
    correctOption: four.answer,
    explanation: r.explanation ?? undefined,
    year: r.year ?? undefined,
    difficulty: r.difficulty ?? 'MEDIUM',
    imageUrl: r.imageUrl ?? undefined,
    examType: r.examType,
    school: r.school ?? undefined,
    sourceType: r.sourceType,
    aiAssisted: r.sourceType === 'AI_ASSISTED' || Boolean(r.explanation),
    explanationReviewed: false,
    sourceRef: r.sourceRef ?? undefined,
    ...(flagged && { flagged: true }),
  };
}

const fileName = (r) => {
  const scope = r.examType === 'POST_UTME' ? `postutme-${(r.school ?? 'choose-school').toLowerCase()}` : 'jamb';
  const kind = r.sourceType === 'AI_ASSISTED' ? '-practice' : '';
  return `${scope}-${r.subject.toLowerCase()}${kind}.json`;
};

export function runEmit() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  const rows = loadRows();
  const files = new Map();
  const add = (name, row) => (files.get(name) ?? files.set(name, []).get(name)).push(row);
  let skipped = 0;

  for (const r of rows) {
    if (r.status === 'accepted') {
      const out = toImportRow(r, r.answer, false);
      if (out) add(fileName(r), out);
      else skipped++;
    } else if (r.needsImage && r.status === 'new') {
      // Unanswerable without its figure: import as a flagged draft so it surfaces first in the Question Builder.
      const out = toImportRow(r, r.key ?? 'A', true);
      if (out) add(`needs-attention-${fileName(r)}`, out);
    }
  }

  const summary = [];
  for (const [name, list] of [...files].sort()) {
    fs.writeFileSync(path.join(DIST_DIR, name), JSON.stringify(list, null, 1));
    summary.push({ file: name, questions: list.length, withImage: list.filter((q) => q.imageUrl).length });
  }
  fs.writeFileSync(path.join(DIST_DIR, 'summary.json'), JSON.stringify(summary, null, 1));
  console.table(summary);
  if (skipped) console.warn(`${skipped} accepted rows skipped (not 4 or 5 options)`);
  console.log(`wrote ${files.size} files to ${DIST_DIR}`);
  console.log('Import each at /admin/imports (Post-UTME files in Post-UTME mode; "choose-school" files need a school picked).');
  console.log(`Subjects: ${Object.entries(SUBJECTS).map(([c, n]) => `${c}=${n}`).join(', ')}`);
}
