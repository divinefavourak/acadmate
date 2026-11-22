// Stage: emit (local, free). Accepted rows → import-ready JSON for /admin/imports, one file per exam/school/subject.
// Rows that need a human (missing or unreadable figure) are emitted too, as flagged drafts in their own file.
// Five-option questions that can't become four-option ones unchanged are held: listed in dist/held/*.md for
// review, which the importer can't read, so they can't be uploaded by accident.
import fs from 'node:fs';
import path from 'node:path';
import { DIST_DIR } from '../config.mjs';
import { toFourOptions } from '../lib/four-options.mjs';
import * as log from '../lib/log.mjs';
import { loadRows } from '../lib/state.mjs';
import { LETTERS, inExam } from '../lib/util.mjs';
import { SUBJECTS } from '../syllabus.mjs';

function toImportRow(r, four, flagged) {
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

/** The questions held back from one subject, as printed (five options, original letters). */
function heldList(held) {
  const reasons = Map.groupBy(held, (h) => h.why);
  const out = [
    '# Held back from import',
    '',
    `${held.length} five-option questions that would be wrong or confusing if cut to four options.`,
    'They are shown as printed. If one is already on the site, find it by its question text and unpublish or fix it.',
    '',
    ...[...reasons].map(([why, list]) => `- ${list.length} × ${why}`),
  ];
  held.forEach(({ row, why }, i) => {
    out.push(
      '',
      `## ${i + 1}. ${row.year ?? 'No year'} · ${row.sourceRef}`,
      '',
      `**Why held:** ${why}`,
      '',
      row.text,
      '',
      ...row.options.map((o, j) => `- **${LETTERS[j]}.** ${o}${LETTERS[j] === row.answer ? '  ✔' : ''}`),
      '',
      `**Explanation:** ${row.explanation ?? '(none)'}`,
    );
    if (row.imageUrl) out.push('', '*(This question has a picture.)*');
  });
  return out.join('\n') + '\n';
}

export function runEmit({ exam }) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  const rows = loadRows();
  const files = new Map();
  const add = (name, row) => (files.get(name) ?? files.set(name, []).get(name)).push(row);
  let skipped = 0;
  const held = new Map();

  for (const r of rows) {
    const folder = inExam(r, exam) ? '' : 'later/';
    if (r.status === 'accepted') {
      const four = toFourOptions(r, r.answer);
      if (!four) {
        if (!folder) skipped++;
      } else if (four.hold) {
        const name = `${folder}held/${fileName(r).replace('.json', '.md')}`;
        (held.get(name) ?? held.set(name, []).get(name)).push({ row: r, why: four.hold });
      } else {
        add(folder + fileName(r), toImportRow(r, four, false));
      }
    } else if (r.needsImage && r.status === 'new') {
      // Unanswerable without its figure: import as a flagged draft so it surfaces first in the Question Builder.
      const four = toFourOptions(r, r.key ?? 'A');
      const out = four && toImportRow(r, four, true);
      if (out) add(`${folder}needs-attention-${fileName(r)}`, out);
    }
  }

  const summary = [];
  for (const [name, list] of [...files].sort()) {
    fs.mkdirSync(path.dirname(path.join(DIST_DIR, name)), { recursive: true });
    fs.writeFileSync(path.join(DIST_DIR, name), JSON.stringify(list, null, 1));
    if (name.startsWith('later/')) continue;
    summary.push({ file: name, questions: list.length, withImage: list.filter((q) => q.imageUrl).length });
  }
  fs.writeFileSync(path.join(DIST_DIR, 'summary.json'), JSON.stringify(summary, null, 1));
  let heldCount = 0;
  for (const [name, list] of held) {
    fs.mkdirSync(path.dirname(path.join(DIST_DIR, name)), { recursive: true });
    fs.writeFileSync(path.join(DIST_DIR, name), heldList(list));
    if (!name.startsWith('later/')) heldCount += list.length;
  }

  log.stage('Writing the files to import (free)');
  if (!summary.length) {
    log.info('No checked questions yet, so there is nothing to import.');
    return;
  }
  const describe = (f) => {
    const m = /^(needs-attention-)?(jamb|postutme-(choose-school|[a-z]+))-([a-z]+)(-practice)?\.json$/.exec(f);
    if (!m) return f;
    const [, attention, , school, code, practice] = m;
    const where = school ? `Post-UTME · ${school === 'choose-school' ? 'school not set' : school.toUpperCase()}` : 'JAMB';
    return `${SUBJECTS[code.toUpperCase()] ?? code} · ${where}${practice ? ' · AI practice' : ''}${attention ? ' · ⚠ needs a human' : ''}`;
  };
  log.table([
    ['File', 'What', 'Questions', 'With picture'],
    ...summary.map((s) => [s.file, describe(s.file), log.fmt.n(s.questions), s.withImage || '–']),
  ]);
  const total = summary.filter((s) => !s.file.startsWith('needs-attention-')).reduce((a, s) => a + s.questions, 0);
  log.ok(`${log.fmt.n(total)} checked questions ready to import, in ${path.relative(process.cwd(), DIST_DIR) || DIST_DIR}`);
  if (heldCount) log.warn(`${heldCount} five-option questions held back so nothing wrong is imported. The list is in the "held" folder.`);
  if (skipped) log.warn(`${skipped} checked questions couldn't be written (they don't have 4 or 5 options).`);
  log.hint('   Import each file at /admin/imports. "needs a human" files import as flagged drafts.');
  if (exam !== 'JAMB') log.hint('   Post-UTME files go in Post-UTME mode; "school not set" files need you to choose the school.');
  if (exam !== 'ALL') log.hint('   Files for other exams are parked in the "later" folder.');
}
