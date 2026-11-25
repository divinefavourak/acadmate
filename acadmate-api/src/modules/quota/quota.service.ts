import { Injectable } from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

// Free accounts may see a set number of distinct questions per subject, for
// life (10 at launch, admin-editable in Settings). After that, CBT in that
// subject needs Premium. Public past-question pages and live sessions are
// outside the quota. While the admin switch is off, the old rule applies:
// at most 20 questions a session.
export const LEGACY_FREE_SESSION_CAP = 20;

// The `error` code on a 402 from POST /exams, so the exam picker can tell
// "this mode is Premium" from "you've used your free questions here".
export const PAYWALL_CODES = {
  premiumMode: 'PREMIUM_REQUIRED',
  quotaExhausted: 'QUOTA_EXHAUSTED',
} as const;

/** A Prisma client or an interactive-transaction client. */
type Db = Prisma.TransactionClient | PrismaService;

/**
 * SQL condition, true when user `userId` has already been served question
 * `q`. It is the single definition of "seen" for both counting the quota and
 * drawing new free questions, so the two can never disagree.
 *
 * Every session counts, open or submitted, so starting several sessions at
 * once can't stretch the allowance. Three kinds don't use it up: live sessions
 * (admin-run events), the daily challenge (outside the quota by design) and
 * retries, whose questions were all served before in the session retried.
 */
export function seenByUser(userId: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM exam_session_questions esq
    JOIN exam_sessions es ON es.id = esq."examSessionId"
    WHERE es."userId" = ${userId}
      AND es."liveSessionId" IS NULL
      AND es.mode NOT IN ('DAILY'::"ExamMode", 'RETRY'::"ExamMode")
      AND esq."questionId" = q.id
  )`;
}

export interface QuotaSummary {
  plan: Plan;
  /** Null when there's no per-subject limit: Premium, or the quota is off. */
  perSubject: number | null;
  /** The Free plan's limit whatever this user's plan, for "Free vs Premium"
   *  comparisons. Null while the quota is off. */
  freePerSubject: number | null;
  /** Distinct questions already served, by subject id. Empty for Premium. */
  used: Record<string, number>;
}

@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** The per-subject allowance for free accounts, or null while it's off. */
  async freeLimit(): Promise<number | null> {
    const q = await this.settings.getFreeQuota();
    return q.enabled ? q.perSubject : null;
  }

  /** Distinct questions this user has been served in one subject. */
  async usedInSubject(userId: string, subjectId: string, db: Db = this.prisma): Promise<number> {
    const rows = await db.$queryRaw<{ used: number }[]>`
      SELECT COUNT(*)::int AS used FROM questions q
      WHERE q."subjectId" = ${subjectId} AND ${seenByUser(userId)}
    `;
    return rows[0]?.used ?? 0;
  }

  async summary(userId: string): Promise<QuotaSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const plan = user?.plan ?? 'FREE';
    const freePerSubject = await this.freeLimit();
    const limit = plan === 'FREE' ? freePerSubject : null;
    if (limit === null) return { plan, perSubject: null, freePerSubject, used: {} };

    const rows = await this.prisma.$queryRaw<{ subjectId: string; used: number }[]>`
      SELECT q."subjectId" AS "subjectId", COUNT(DISTINCT esq."questionId")::int AS used
      FROM exam_session_questions esq
      JOIN exam_sessions es ON es.id = esq."examSessionId"
      JOIN questions q ON q.id = esq."questionId"
      WHERE es."userId" = ${userId} AND es."liveSessionId" IS NULL
        AND es.mode NOT IN ('DAILY'::"ExamMode", 'RETRY'::"ExamMode")
      GROUP BY q."subjectId"
    `;
    return {
      plan,
      perSubject: limit,
      freePerSubject,
      used: Object.fromEntries(rows.map((r) => [r.subjectId, r.used])),
    };
  }

  /**
   * Serialise quota checks for one user inside a transaction. Two "Start"
   * taps that arrive together would otherwise both read "10 left" and both
   * create a 10-question session. The lock is released when the transaction
   * ends and doesn't block anyone else.
   */
  async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'quota:' + userId}))`;
  }
}
