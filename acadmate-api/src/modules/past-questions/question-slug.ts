/**
 * Pure helpers for public past-question URLs and snippets. No Nest or Prisma
 * imports, so they can be checked in isolation.
 */

/** Lower-case ASCII words joined by "-", cut at a word boundary. */
export function slugify(input: string, maxLen = 80): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= maxLen) return slug;
  const cut = slug.slice(0, maxLen + 1);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, maxLen)).replace(/-+$/, '');
}

/**
 * Question text as readable plain text, for titles, meta descriptions and
 * JSON-LD. Math keeps its content but loses the LaTeX syntax:
 * "$\frac{1}{2}mv^2$" becomes "1/2 mv^2".
 */
export function toPlainText(text: string): string {
  return text
    .replace(/\$\$([\s\S]*?)\$\$|\$([^$]*)\$/g, (_m, block?: string, inline?: string) =>
      ` ${latexToPlain(block ?? inline ?? '')} `,
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g, (_m, a, b, c, d) => a ?? b ?? c ?? d)
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:?!])/g, '$1')
    .trim();
}

function latexToPlain(math: string): string {
  // (?![a-zA-Z]) rather than \b: "\times10" has no word boundary before the digit.
  const SYMBOLS: Record<string, string> = {
    times: '×', cdot: '×', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥',
    pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', lambda: 'λ', mu: 'μ', omega: 'ω',
    Omega: 'Ω', Delta: 'Δ', circ: '°', degree: '°', pm: '±', infty: '∞',
  };
  return math
    .replace(/\\begin\{[a-z]*\}/g, ' [')
    .replace(/\\end\{[a-z]*\}/g, '] ')
    .replace(/\\\\/g, '; ')
    .replace(/&/g, ' ')
    // Escaped braces are literal (a set like \{2,4\}); park them so the
    // grouping-brace cleanup below doesn't remove them.
    .replace(/\\\{/g, '')
    .replace(/\\\}/g, '')
    .replace(/\\([%$#_&])/g, '$1')
    // "22\frac{1}{2}" is a mixed number: keep a space so it doesn't read as 221/2.
    .replace(/(\d)\s*\\frac/g, '$1 \\frac')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
    .replace(/\\([a-zA-Z]+)(?![a-zA-Z])/g, (m, name: string) => SYMBOLS[name] ?? m)
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '')
    .replace(//g, '{')
    .replace(//g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First `max` characters of plain text, cut at a word boundary with an ellipsis. */
export function snippet(text: string, max: number): string {
  const plain = toPlainText(text);
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

/**
 * Stable public slug, e.g. "jamb-physics-1990-in-a-resonance-tube-experiment-k3j9x2".
 * The id suffix keeps it unique even when two questions open with the same words.
 * Slugs are stored once and never recomputed, so editing a question's text
 * doesn't break a URL that search engines have already indexed.
 */
export function buildQuestionSlug(q: {
  id: string;
  text: string;
  year: number;
  subjectName: string;
  exam?: string;
}, idSuffixLength = 6): string {
  const words = slugify(toPlainText(q.text).replace(/[^\p{L}\p{N}\s]/gu, ' '), 60) || 'question';
  const suffix = q.id.slice(-idSuffixLength).toLowerCase();
  return [slugify(q.exam ?? 'jamb'), slugify(q.subjectName), q.year, words, suffix].join('-');
}
