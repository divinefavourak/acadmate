// The importer takes exactly four options; older papers have five (A–E).
//
// Conversion always drops the same option: E, or D when E is the answer (E then becomes D). That choice must not
// change: it is part of the import fingerprint, so changing it would duplicate questions already imported.
//
// What can change is whether a question is safe to convert at all. If anything the student reads depends on the
// dropped or moved option, the question is held rather than exported. This fails closed: a false alarm costs one
// held question, a miss teaches a student something wrong.
import { LETTERS, normalise } from './util.mjs';

const withoutMath = (s) => s.replace(/\$[^$]*\$/g, ' ~ ');
// A compass direction after a degree sign (147°E) is not an option letter.
const withoutCompass = (s) => s.replace(/°\s*[NSEW]\b/g, '° ~');
// Formatting-insensitive form for "is this option's text mentioned?"
const plain = (s) =>
  normalise(
    s
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2') // \frac{5}{6} reads as 5/6
      .replace(/\\(?:text|mathrm)\b/g, '')
      .replace(/\\[,;! ]/g, ' ')
      .replace(/[$\\{}*_^]/g, ''),
  );
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// Compared by value, so 5.0, 5 and "five" all match.
const numbers = (s) => (plain(s).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const spokenNumbers = (s) =>
  (s.toLowerCase().match(/\b[a-z]+\b/g) ?? []).map((w) => NUMBER_WORDS.indexOf(w)).filter((i) => i > 1);
// Content words, cut to six letters so "oxidised/oxidation" and "freeze/freezing" roughly match.
const words6 = (s) => (plain(s).match(/[a-z]{4,}/g) ?? []).map((w) => w.slice(0, 6));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

const RELATIVE_OPTION = /\b(?:all|none|both|any|neither|either|some) (?:of )?(?:the )?(?:above|these|options)\b|\babove\b.*\bdepending\b/i;
const LABEL_OPTION = /^(?:(?:figure|fig\.?|graph|diagram|curve)\s*)?\(?[A-E]\)?\.?$/i;
const LETTER_RANGE = /\bA\s*(?:-|–|—|to|through)\s*E\b|\bA,\s*B,\s*C,\s*D,?\s*(?:and|or|&)?\s*E\b/;
const OPTION_COUNT = /\b(?:five|5) (?:options|choices|alternatives|answers)\b|\bother four\b|\bfour other\b/i;
const POSITION = /\b(?:last|final|fourth|fifth) (?:option|choice|statement|answer|alternative)\b/i;
const TALKS_ABOUT_OPTIONS = /\b(?:options?|choices?|tempting|distractors?|alternatives?)\b/i;
// A sentence turning down a candidate answer, whether or not it says "option".
const REJECTS = /\b(?:options?|choices?|tempting|distractors?|alternatives?|fails?|wrong|incorrect|unrealistic|impractical|swapped|others?|rather than)\b/i;

// Found by reading every converted question (2026-11-22): the explanation argues against the removed option in
// words no pattern catches ("so it is not the answer", "the others are standard facts: …").
const REVIEWED_HOLDS = new Set([
  'p-ENG-44c7906857',
  'p-PHY-46dce11b32',
  'p-PHY-2767ec3eda',
  'p-CHM-aa0f2a1dc7',
  'p-CHM-2d87126d13',
]);

/** Why this five-option question can't become a four-option one unchanged, or null if it can. */
function holdReason({ id, text, options, explanation, imageUrl }, answer, drop) {
  if (REVIEWED_HOLDS.has(id)) return 'the explanation discusses the removed option';
  const moved = drop === 3; // E is the answer, so it moves up to D
  const affected = moved ? '[DE]' : 'E';
  const kept = options.filter((_, i) => i !== drop);
  const expl = explanation ?? '';

  // The question itself
  const stem = text.split('QUESTION:').at(-1);
  if (LETTER_RANGE.test(stem) || OPTION_COUNT.test(stem)) return 'the question refers to five options';
  if (new RegExp(`\\b(?:options?|statements?|choices?)\\s+\\(?${affected}\\b`).test(stem)) return 'the question names the removed or moved option';

  // The options
  if (options.every((o) => LABEL_OPTION.test(o.trim()))) return 'the options are labels of five figures';
  if (moved && options.some((o) => RELATIVE_OPTION.test(o))) return 'an "all/none of the above" option would change meaning';
  const optionRef = new RegExp(`^\\(?${affected}\\)? only\\b|\\b[A-E] ?(?:,|and|&|or) ?${affected}\\b|\\b${affected} ?(?:,|and|&|or) ?[A-E]\\b`);
  if (kept.some((o) => optionRef.test(withoutMath(o)))) return 'another option refers to the removed or moved one';
  if (new Set(options.map(plain)).size < options.length) return 'two options read the same';

  // The figure: a crop can include the printed option letters, which we can't read here
  if (moved && imageUrl) return 'the figure may show the old option letters';

  // The explanation
  const words = withoutCompass(withoutMath(expl));
  if (new RegExp(`(?:^|[^A-Za-z0-9])${affected}(?=$|[^A-Za-z0-9])`).test(words)) return 'the explanation uses the removed or moved letter';
  if (new RegExp(`\\b(?:options?|statements?|choices?|figures?)\\s*\\$\\s*\\(?${affected}\\)?\\s*\\$|\\\\text\\{[^}]*\\boptions? ${affected}\\b`, 'i').test(expl)) {
    return 'the explanation uses the removed or moved letter';
  }
  if (OPTION_COUNT.test(expl) || POSITION.test(expl)) return 'the explanation counts or positions the options';

  // Discussing the removed option without its letter: by value, by its words, or by a paraphrase
  const gone = plain(options[drop]);
  const keptNumbers = new Set(kept.flatMap(numbers));
  const onlyInGone = numbers(options[drop]).filter((n) => !keptNumbers.has(n));
  const shared = new Set([...kept, stem].flatMap(words6));
  const goneWords = [...new Set(words6(options[drop]).filter((w) => !shared.has(w)))];
  const goneIsDistinct = gone.length >= 3 && ![...kept, stem].some((s) => plain(s).includes(gone));

  for (const sentence of expl.split(/(?<=[.!?])\s+/)) {
    const said = plain(sentence);
    const aboutOptions = TALKS_ABOUT_OPTIONS.test(sentence);
    const rejects = REJECTS.test(sentence);
    const quoted =
      gone && (aboutOptions || rejects || goneIsDistinct) &&
      new RegExp(`(?:^|[^a-z0-9.])${escapeRe(gone)}(?=$|[^a-z0-9])`).test(said);
    const valued = aboutOptions && [...numbers(sentence), ...spokenNumbers(sentence)].some((n) => onlyInGone.includes(n));
    const saidWords = new Set(words6(sentence));
    const paraphrased = rejects && goneWords.length > 0 && goneWords.filter((w) => saidWords.has(w)).length * 2 >= goneWords.length;
    if (quoted || valued || paraphrased) return 'the explanation discusses the removed option';
  }
  return null;
}

/**
 * row → { options, answer, hold }
 *   hold: why it must not be exported, or null.
 * Returns null when the row doesn't have four or five options.
 */
export function toFourOptions(row, answer) {
  if (row.options.length === 4) return { options: row.options, answer, hold: null };
  if (row.options.length !== 5) return null;
  const from = LETTERS.indexOf(answer);
  const drop = from === 4 ? 3 : 4;
  return {
    options: row.options.filter((_, i) => i !== drop),
    // By position, not by text: two options can read the same.
    answer: LETTERS[from === 4 ? 3 : from],
    hold: holdReason(row, answer, drop),
  };
}
