import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type LeaderboardType = 'UTME' | 'POST_UTME';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  avatarConfig: unknown;
  avatarUrl: string | null;
  points: number;
};

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(type: LeaderboardType = 'UTME', limit = 50): Promise<LeaderboardEntry[]> {
    // Resolve which exam sessions belong to this leaderboard type
    const sessions = await this.prisma.examSession.findMany({
      where: { mode: type === 'POST_UTME' ? 'POST_UTME' : { not: 'POST_UTME' } },
      select: { id: true },
    });

    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const grouped = await this.prisma.result.groupBy({
      by: ['userId'],
      where: { examSessionId: { in: sessionIds } },
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
