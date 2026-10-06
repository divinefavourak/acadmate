import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

export type LeaderboardType = 'UTME' | 'POST_UTME';

/**
 * Narrows a leaderboard to a year. `period` is the calendar year the points
 * were earned in; `paperYear` is the year of the past-paper questions answered.
 */
export type LeaderboardScope = { period?: number; paperYear?: number };

export type LeaderboardYears = { periods: number[]; paperYears: number[] };

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  avatarConfig: unknown;
  avatarUrl: string | null;
  points: number;
};

const TTL = 600; // 10 min — good enough freshness without thrashing the DB

// Students are in Nigeria (UTC+1, no DST), so a "year" runs on Lagos time.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

function lagosYearBounds(year: number) {
  return {
    gte: new Date(Date.UTC(year, 0, 1) - LAGOS_OFFSET_MS),
    lt: new Date(Date.UTC(year + 1, 0, 1) - LAGOS_OFFSET_MS),
  };
}

function lagosYear(date: Date) {
  return new Date(date.getTime() + LAGOS_OFFSET_MS).getUTCFullYear();
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getLeaderboard(
    type: LeaderboardType = 'UTME',
    limit = 50,
    scope: LeaderboardScope = {},
  ): Promise<LeaderboardEntry[]> {
    const KEY = `leaderboard:${type}:${limit}:${scope.period ?? 'all'}:${scope.paperYear ?? 'any'}`;

    const cached = await this.cache.get<LeaderboardEntry[]>(KEY);
    if (cached) return cached;

    const data = await this.computeLeaderboard(type, limit, scope);
    void this.cache.set(KEY, data, TTL);
    return data;
  }

  /** Years that have something to show, newest first, for the year pickers. */
  async getYears(type: LeaderboardType = 'UTME'): Promise<LeaderboardYears> {
    const KEY = `leaderboard:years:${type}`;

    const cached = await this.cache.get<LeaderboardYears>(KEY);
    if (cached) return cached;

    const resultWhere = this.resultWhere(type);
    const [span, paperRows] = await Promise.all([
      this.prisma.result.aggregate({
        where: resultWhere,
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      this.prisma.resultYearBreakdown.findMany({
        where: { result: resultWhere },
        distinct: ['year'],
        select: { year: true },
        orderBy: { year: 'desc' },
      }),
    ]);

    const periods: number[] = [];
    if (span._min.createdAt && span._max.createdAt) {
      const first = lagosYear(span._min.createdAt);
      for (let y = lagosYear(span._max.createdAt); y >= first; y--) periods.push(y);
    }

    const data = { periods, paperYears: paperRows.map((r) => r.year) };
    void this.cache.set(KEY, data, TTL);
    return data;
  }

  private resultWhere(type: LeaderboardType, period?: number) {
    return {
      examSession: {
        mode: type === 'POST_UTME' ? ('POST_UTME' as const) : { not: 'POST_UTME' as const },
      },
      ...(period != null && { createdAt: lagosYearBounds(period) }),
    };
  }

  private async computeLeaderboard(
    type: LeaderboardType,
    limit: number,
    scope: LeaderboardScope,
  ): Promise<LeaderboardEntry[]> {
    const resultWhere = this.resultWhere(type, scope.period);

    // Past-paper boards rank on the per-year snapshot taken at submission;
    // everything else ranks on the result totals.
    const grouped =
      scope.paperYear != null
        ? await this.prisma.resultYearBreakdown.groupBy({
            by: ['userId'],
            where: { year: scope.paperYear, result: resultWhere },
            _sum: { correct: true },
            orderBy: { _sum: { correct: 'desc' } },
            take: limit,
          })
        : await this.prisma.result.groupBy({
            by: ['userId'],
            where: resultWhere,
            _sum: { correct: true },
            orderBy: { _sum: { correct: 'desc' } },
            take: limit,
          });

    if (grouped.length === 0) return [];

    const userIds = grouped.map((g) => g.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        studentProfile: { select: { avatarConfig: true, avatarUrl: true } },
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return grouped.map((g, i) => {
      const user = userMap.get(g.userId);
      return {
        rank: i + 1,
        userId: g.userId,
        name: user?.name ?? null,
        email: user?.email ?? '',
        avatarConfig: user?.studentProfile?.avatarConfig ?? null,
        avatarUrl: user?.studentProfile?.avatarUrl ?? null,
        points: (g._sum.correct ?? 0) * 10,
      };
    });
  }
}
