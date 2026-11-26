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

// Referrals: every friend who signs up with a student's link and finishes
// onboarding adds this many bonus questions, usable in any subject, up to
// MAX_REWARDED_REFERRALS friends. There's no email verification, so the cap
// limits what fake sign-ups could farm.
export const REFERRAL_BONUS = 10;
export const MAX_REWARDED_REFERRALS = 20;

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
  /** Referral bonus questions: earned, and still unused. */
  bonus: { total: number; left: number };
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

  /** Distinct questions this user has been served, by subject id. */
  async usedBySubject(userId: string, db: Db = this.prisma): Promise<Record<string, number>> {
    const rows = await db.$queryRaw<{ subjectId: string; used: number }[]>`
      SELECT q."subjectId" AS "subjectId", COUNT(DISTINCT esq."questionId")::int AS used
      FROM exam_session_questions esq
      JOIN exam_sessions es ON es.id = esq."examSessionId"
      JOIN questions q ON q.id = esq."questionId"
      WHERE es."userId" = ${userId} AND es."liveSessionId" IS NULL
        AND es.mode NOT IN ('DAILY'::"ExamMode", 'RETRY'::"ExamMode")
      GROUP BY q."subjectId"
    `;
    return Object.fromEntries(rows.map((r) => [r.subjectId, r.used]));
  }

  /** Bonus questions earned from friends who joined and finished onboarding. */
  async bonusTotal(userId: string, db: Db = this.prisma): Promise<number> {
    const friends = await db.user.count({ where: { referredById: userId, onboardedAt: { not: null } } });
    return Math.min(friends, MAX_REWARDED_REFERRALS) * REFERRAL_BONUS;
  }

  /**
   * Free questions left in one subject: what's left of that subject's own
   * allowance, plus whatever bonus hasn't been spent anywhere. Bonus is spent
   * only once a subject's own allowance is used up.
   */
  async allowance(userId: string, subjectId: string, limit: number, db: Db = this.prisma) {
    const [used, bonus] = await Promise.all([this.usedBySubject(userId, db), this.bonusTotal(userId, db)]);
    const bonusLeft = bonusRemaining(used, limit, bonus);
    return {
      remaining: Math.max(0, limit - (used[subjectId] ?? 0)) + bonusLeft,
      bonusTotal: bonus,
      bonusLeft,
    };
  }

  async summary(userId: string): Promise<QuotaSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const plan = user?.plan ?? 'FREE';
    const freePerSubject = await this.freeLimit();
    const limit = plan === 'FREE' ? freePerSubject : null;
    const bonus = await this.bonusTotal(userId);
    if (limit === null) return { plan, perSubject: null, freePerSubject, used: {}, bonus: { total: bonus, left: bonus } };

    const used = await this.usedBySubject(userId);
    return {
      plan,
      perSubject: limit,
      freePerSubject,
      used,
      bonus: { total: bonus, left: bonusRemaining(used, limit, bonus) },
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

/** Bonus not yet spent: questions served beyond each subject's own limit use it up. */
export function bonusRemaining(used: Record<string, number>, limit: number, bonus: number): number {
  const spent = Object.values(used).reduce((sum, n) => sum + Math.max(0, n - limit), 0);
  return Math.max(0, bonus - spent);
}
