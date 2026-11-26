import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService, ReferralContestSettings } from '../settings/settings.service';
import { lagosDayStart } from '../../common/utils/lagos-day.util';

const DAY_MS = 86_400_000;
const STUDENT_BOARD_SIZE = 20;
const ADMIN_BOARD_SIZE = 50;

export type ContestState = 'none' | 'upcoming' | 'live' | 'ended';

interface Standing {
  userId: string;
  friends: number;
  /** When their latest counted friend finished onboarding (tie-break: earlier wins). */
  last: Date;
}

/** "Ada Okonkwo" -> "Ada O." so the public board doesn't show full names. */
function shortName(name: string | null, email: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.split('@')[0].slice(0, 12);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

/**
 * The referral contest: students ranked by friends who signed up with their
 * link during the contest dates and finished onboarding before it ended.
 * Admin accounts and referrers an admin has disqualified are left out.
 */
@Injectable()
export class ReferralContestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private window(c: ReferralContestSettings) {
    if (!c.start || !c.end) return null;
    const from = lagosDayStart(c.start);
    const to = new Date(lagosDayStart(c.end).getTime() + DAY_MS); // end day inclusive
    const now = Date.now();
    const state: ContestState = now < from.getTime() ? 'upcoming' : now >= to.getTime() ? 'ended' : 'live';
    return { from, to, state };
  }

  private async standings(c: ReferralContestSettings, from: Date, to: Date): Promise<Standing[]> {
    const rows = await this.prisma.$queryRaw<{ userId: string; friends: number; last: Date }[]>`
      SELECT f."referredById" AS "userId", COUNT(*)::int AS friends, MAX(f."onboardedAt") AS last
      FROM users f
      JOIN users r ON r.id = f."referredById"
      WHERE f."createdAt" >= ${from} AND f."createdAt" < ${to}
        AND f."onboardedAt" IS NOT NULL AND f."onboardedAt" < ${to}
        AND r.role <> 'ADMIN'::"Role"
      GROUP BY f."referredById"
      ORDER BY friends DESC, last ASC
    `;
    const excluded = new Set(c.excluded);
    return rows.filter((r) => !excluded.has(r.userId));
  }

  /** What students see: dates, prize, the top 20 (short names) and their own place. */
  async forStudent(userId: string) {
    const c = await this.settings.getReferralContest();
    const w = this.window(c);
    if (!w) return { state: 'none' as ContestState, start: null, end: null, prize: c.prize, entries: [], you: null };

    const all = await this.standings(c, w.from, w.to);
    const top = all.slice(0, STUDENT_BOARD_SIZE);
    const users = await this.prisma.user.findMany({
      where: { id: { in: top.map((t) => t.userId) } },
      select: { id: true, name: true, email: true, studentProfile: { select: { avatarConfig: true, avatarUrl: true } } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const mine = all.findIndex((s) => s.userId === userId);

    return {
      state: w.state,
      start: c.start,
      end: c.end,
      prize: c.prize,
      entries: top.map((s, i) => {
        const u = byId.get(s.userId);
        return {
          rank: i + 1,
          name: u ? shortName(u.name, u.email) : 'Student',
          avatarConfig: u?.studentProfile?.avatarConfig ?? null,
          avatarUrl: u?.studentProfile?.avatarUrl ?? null,
          friends: s.friends,
          you: s.userId === userId,
        };
      }),
      you: {
        rank: mine >= 0 ? mine + 1 : null,
        friends: mine >= 0 ? all[mine].friends : 0,
        disqualified: c.excluded.includes(userId),
      },
    };
  }

  /**
   * What admins see before paying: full names and emails, and each counted
   * friend with when they signed up and set up, and how many exams they
   * finished. Bursts of sign-ups minutes apart with no exams are the usual
   * sign of fake accounts.
   */
  async forAdmin() {
    const c = await this.settings.getReferralContest();
    const w = this.window(c);
    const excludedUsers = await this.prisma.user.findMany({
      where: { id: { in: c.excluded } },
      select: { id: true, name: true, email: true },
    });
    if (!w) return { settings: c, state: 'none' as ContestState, entries: [], excludedUsers };

    const top = (await this.standings(c, w.from, w.to)).slice(0, ADMIN_BOARD_SIZE);
    const ids = top.map((t) => t.userId);
    const [referrers, friends] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, plan: true, createdAt: true } }),
      this.prisma.user.findMany({
        where: {
          referredById: { in: ids },
          createdAt: { gte: w.from, lt: w.to },
          onboardedAt: { not: null, lt: w.to },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, referredById: true, name: true, email: true, createdAt: true, onboardedAt: true },
      }),
    ]);
    const finished = await this.prisma.result.groupBy({
      by: ['userId'],
      where: { userId: { in: friends.map((f) => f.id) } },
      _count: { _all: true },
    });
    const examsBy = new Map(finished.map((r) => [r.userId, r._count._all]));
    const refById = new Map(referrers.map((u) => [u.id, u]));

    return {
      settings: c,
      state: w.state,
      excludedUsers,
      entries: top.map((s, i) => ({
        rank: i + 1,
        userId: s.userId,
        name: refById.get(s.userId)?.name ?? null,
        email: refById.get(s.userId)?.email ?? '',
        plan: refById.get(s.userId)?.plan ?? 'FREE',
        friends: s.friends,
        friendList: friends
          .filter((f) => f.referredById === s.userId)
          .map((f) => ({
            name: f.name,
            email: f.email,
            signedUpAt: f.createdAt,
            onboardedAt: f.onboardedAt,
            examsFinished: examsBy.get(f.id) ?? 0,
          })),
      })),
    };
  }

  /** Disqualify a referrer from the contest, or put them back. */
  async setExcluded(userId: string, excluded: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const c = await this.settings.getReferralContest();
    const set = new Set(c.excluded);
    if (excluded) set.add(userId);
    else set.delete(userId);
    await this.settings.setReferralContest({ excluded: [...set] });
    return { userId, excluded };
  }
}
