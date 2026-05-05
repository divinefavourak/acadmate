import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(limit = 20, offset = 0, role?: string) {
    const safeLimit = Math.min(limit, 100);
    const where = role ? { role } : {};
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        take: safeLimit,
        skip: offset,
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          studentProfile: {
            select: { targetYear: true, courseChoice: true, institution: true },
          },
          _count: { select: { examSessions: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, limit: safeLimit, offset };
  }

  async getUserStats(userId: string) {
    const [user, examCount, resultStats, recentSessions] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, email: true, role: true, createdAt: true,
          studentProfile: { select: { targetYear: true, courseChoice: true, institution: true } },
        },
      }),
      this.prisma.examSession.count({ where: { userId } }),
      this.prisma.result.aggregate({
        where: { userId },
        _avg: { score: true },
        _max: { score: true },
        _count: { id: true },
      }),
      this.prisma.examSession.findMany({
        where: { userId },
        take: 5,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true, mode: true, status: true, totalQuestions: true,
          startedAt: true, submittedAt: true,
          result: { select: { score: true, correct: true } },
        },
      }),
    ]);

    return {
      user,
      recentSessions,
      totalExams: examCount,
      averageScore: resultStats._avg.score ?? 0,
      bestScore: resultStats._max.score ?? 0,
    };
  }
}
