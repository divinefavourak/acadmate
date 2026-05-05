import type { PrismaClient } from "@prisma/client";

export type ExpiryCheckResult =
  | { expired: false }
  | { expired: true };

/**
 * Checks a single session and marks it TIMED_OUT if past its deadline.
 * Safe to call from route handlers — performs the write only when necessary.
 * Will also be called from a cron job that sweeps all stale sessions.
 */
export async function resolveExamExpiry(
  db: PrismaClient,
  sessionId: string,
  status: string,
  expiresAt: Date | null
): Promise<ExpiryCheckResult> {
  if (status !== "IN_PROGRESS" || !expiresAt || new Date() <= expiresAt) {
    return { expired: false };
  }

  await db.examSession.update({
    where: { id: sessionId },
    data: { status: "TIMED_OUT", submittedAt: new Date() },
  });

  return { expired: true };
}

/**
 * Bulk-expires all sessions that are still IN_PROGRESS but past their deadline.
 * Designed to be called by a scheduled job (cron / BullMQ worker in NestJS).
 * Returns the number of sessions that were expired.
 */
export async function expireStaleSessions(db: PrismaClient): Promise<number> {
  const { count } = await db.examSession.updateMany({
    where: {
      status: "IN_PROGRESS",
      expiresAt: { lt: new Date() },
    },
    data: { status: "TIMED_OUT", submittedAt: new Date() },
  });

  return count;
}
