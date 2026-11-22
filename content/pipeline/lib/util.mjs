import { createHash } from 'node:crypto';

/**
 * Mirrors normaliseForIdentity in acadmate-api (question-identity.ts): case, whitespace, markup and curly
 * quotes only. Decimal points, operators, brackets and signs are kept, so "1.5" ≠ "15".
 */
export function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[\s ]+/g, ' ')
    .trim()
    .replace(/[\s.?!:;]+$/, '');
}

/**
 * Key for spotting the same question across sources that only differ in LaTeX wrapping ($x^{2}$ vs x^2).
 * Strips math delimiters, backslashes, braces and spaces; keeps operators and grouping, so
 * "2*(3+4)" and "2*3+4" stay different.
 */
export function looseKey(text) {
  return normalise(text).replace(/[$\\{}\s]/g, '');
}

export function shortHash(s) {
  return createHash('sha1').update(s).digest('hex').slice(0, 10);
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Is this row or source inside the --exam scope? */
export const inExam = (item, exam) => exam === 'ALL' || item.examType === exam;

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const [k, inline] = a.slice(2).split('=');
    const next = argv[i + 1];
    if (inline !== undefined) args[k] = inline;
    else if (next !== undefined && !next.startsWith('--')) args[k] = argv[++i];
    else args[k] = true;
  }
  return args;
}

export const csv = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : null);

// Sub-dollar amounts keep two significant figures, so a per-question cost doesn't print as $0.00.
export const usd = (n) => `$${n >= 1 || n === 0 ? n.toFixed(2) : n.toPrecision(2)}`;
