import { Prisma } from '@prisma/client';

// An import's Publish is its first release, not a "make everything live" switch. Without this, it put back every
// question an admin had deliberately unpublished. The Publish endpoint and the Import History counts both use
// these definitions, so the button can't offer something the endpoint wouldn't do.

/** Drafts nobody has decided on. Any publish or unpublish sets `reviewedAt` (see publishDecision). */
export const AWAITING_RELEASE = {
  isPublished: false,
  isFlagged: false,
  reviewedAt: null,
} satisfies Prisma.QuestionWhereInput;

/**
 * Published by hand before decisions were recorded. The unpublished questions beside these can't be told apart
 * from withdrawn ones, so their import counts as already released.
 */
const PUBLISHED_UNRECORDED = { isPublished: true, reviewedAt: null } satisfies Prisma.QuestionWhereInput;

/** The fields to write whenever an admin publishes or unpublishes a question. */
export const publishDecision = (adminId: string, isPublished: boolean) => ({
  isPublished,
  reviewedAt: new Date(),
  reviewedById: adminId,
});

/** Which of these imports have had their release. What is still unpublished in them is published from Questions. */
export async function releasedImportIds(
  db: Prisma.TransactionClient,
  imports: { id: string; publishedRows: number }[],
): Promise<Set<string>> {
  const unrecorded = await db.question.groupBy({
    by: ['importId'],
    where: { importId: { in: imports.map((i) => i.id) }, ...PUBLISHED_UNRECORDED },
  });
  return new Set([
    ...imports.filter((i) => i.publishedRows > 0).map((i) => i.id),
    ...unrecorded.map((q) => q.importId!),
  ]);
}
