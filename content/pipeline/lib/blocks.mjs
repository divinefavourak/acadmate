// Turn rows into content blocks for a multi-question request: each question as text, its figure as an image.
import { LETTERS } from './util.mjs';

function imageBlock(url) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(url);
  if (m) return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
  return { type: 'image', source: { type: 'url', url } };
}

/**
 * rows → [{type:'text'|'image'}...]. Questions are labelled q1..qN; the caller maps labels back to rows.
 * `extra(row)` appends per-question context (e.g. the booklet answer for the verifier).
 */
export function questionBlocks(rows, extra = () => '') {
  const content = [];
  rows.forEach((r, i) => {
    const opts = r.options.map((o, j) => `${LETTERS[j]}. ${o}`).join('\n');
    const head = `### q${i + 1}${r.year ? ` (${r.examType === 'POST_UTME' ? 'Post-UTME' : 'JAMB'} ${r.year})` : ''}`;
    content.push({ type: 'text', text: `${head}\n${r.text}\n\n${opts}${r.imageUrl ? '\n[The figure for this question follows.]' : ''}${extra(r)}` });
    if (r.imageUrl) content.push(imageBlock(r.imageUrl));
  });
  return content;
}
