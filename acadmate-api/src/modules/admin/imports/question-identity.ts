import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';

/**
 * Normalise for identity: case, whitespace, markup and curly quotes only. Everything that can change meaning
 * — decimal points, operators, brackets, signs — is kept, so "1.5" ≠ "15" and "2*(3+4)" ≠ "2*3+4".
 * A trailing full stop or question mark is dropped: "…is" and "…is?" are the same question.
 */
export function normaliseForIdentity(s: string): string {
  return s
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[\s ]+/g, ' ')
    .trim()
    .replace(/[\s.?!:;]+$/, '');
}

/**
 * Figure fingerprint: the bytes of an embedded image, else the link itself. Cloudinary names uploads randomly,
 * so a stored URL can't be traced back to its bytes; identical embedded images still match each other.
 */
function figureKey(imageUrl?: string | null): string {
  if (!imageUrl) return '';
  const data = /^data:[^;]+;base64,(.+)$/s.exec(imageUrl)?.[1];
  return createHash('sha256').update(data ?? imageUrl).digest('hex').slice(0, 24);
}

/**
 * Identity of a question within its exam scope and subject. Option order is ignored (a reshuffled copy is a
 * duplicate); subject, examType and school are included (the same stem may legitimately live in two subjects
 * or two schools' Post-UTME pools); the figure is included (identical stems over different diagrams differ).
 */
export function questionContentHash(q: {
  subjectId: string;
  text: string;
  options: string[];
  examType?: string | null;
  school?: string | null;
  imageUrl?: string | null;
}): string {
  const opts = q.options.map(normaliseForIdentity).sort().join('␟');
  return createHash('sha256')
    .update([q.subjectId, q.examType ?? '', (q.school ?? '').toUpperCase(), normaliseForIdentity(q.text), opts, figureKey(q.imageUrl)].join('␞'))
    .digest('hex');
}

export const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/**
 * Recompute a stored question's hash from what's in the database now (after an admin create/edit).
 * If an identical question already holds that hash, the hash is cleared: the bank already contains a
 * duplicate, and a stale hash would wrongly block or admit future imports.
 */
export async function syncContentHash(prisma: PrismaService, questionId: string): Promise<void> {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: { subjectId: true, text: true, examType: true, school: true, imageUrl: true, options: { select: { text: true } } },
  });
  if (!q) return;
  const contentHash = questionContentHash({ ...q, options: q.options.map((o) => o.text) });
  try {
    await prisma.question.update({ where: { id: questionId }, data: { contentHash } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    await prisma.question.update({ where: { id: questionId }, data: { contentHash: null } });
  }
}
