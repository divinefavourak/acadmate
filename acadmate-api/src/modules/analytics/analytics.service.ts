import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

type TrendPoint  = { id: string; score: number; mode: string; date: Date };
type SubjectPerf = { subjectId: string; name: string; correct: number; total: number; percentage: number };
type WeakTopic   = { topicId: string; name: string; correct: number; total: number; percentage: number };

export interface AnalyticsResult {
  totalTests: number;
  averageScore: number;
  bestScore: number;
  recentTrend: TrendPoint[];
  subjectPerformance: SubjectPerf[];
  weakTopics: WeakTopic[];
}

const CACHE_TTL = 60; // 60 s — matches the old in-memory TTL

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async invalidateCache(userId: string): Promise<void> {
    // Bust all limit variants for this user with a prefix sweep.
    await this.cache.delByPrefix(`analytics:${userId}:`);
  }

  async getStudentAnalytics(userId: string, limit: number = 100): Promise<AnalyticsResult> {
    const KEY = `analytics:${userId}:${limit}`;

    const cached = await this.cache.get<AnalyticsResult>(KEY);
    if (cached) return cached;

    const results = await this.prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        score: true,
        correct: true,
        incorrect: true,
        unanswered: true,
        totalQuestions: true,
        createdAt: true,
        examSession: { select: { mode: true } },
        subjectBreakdowns: {
          select: { subjectId: true, name: true, correct: true, total: true },
        },
        topicBreakdowns: {
          select: { topicId: true, name: true, correct: true, total: true },
        },
      },
    });

    if (results.length === 0) {
      const empty: AnalyticsResult = {
        totalTests: 0,
        averageScore: 0,
        bestScore: 0,
        recentTrend: [],
        subjectPerformance: [],
        weakTopics: [],
      };
      void this.cache.set(KEY, empty, CACHE_TTL);
      return empty;
    }

    const totalTests = results.length;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalTests;
    const bestScore = Math.max(...results.map((r) => r.score));

    const recentTrend = results.slice(-10).map((r) => ({
      id: r.id,
      score: r.score,
      mode: r.examSession.mode,
      date: r.createdAt,
    }));

    const subjectAgg: Record<string, { subjectId: string; name: string; correct: number; total: number }> = {};
    for (const result of results) {
      for (const s of result.subjectBreakdowns) {
        if (!subjectAgg[s.subjectId]) {
          subjectAgg[s.subjectId] = { subjectId: s.subjectId, name: s.name, correct: 0, total: 0 };
        }
        subjectAgg[s.subjectId].correct += s.correct;
        subjectAgg[s.subjectId].total += s.total;
      }
    }

    const subjectPerformance = Object.values(subjectAgg).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    }));

    const topicAgg: Record<string, { topicId: string; name: string; correct: number; total: number }> = {};
    for (const result of results) {
      for (const t of result.topicBreakdowns) {
        if (!topicAgg[t.topicId]) {
          topicAgg[t.topicId] = { topicId: t.topicId, name: t.name, correct: 0, total: 0 };
        }
        topicAgg[t.topicId].correct += t.correct;
        topicAgg[t.topicId].total += t.total;
      }
    }

    const weakTopics = Object.values(topicAgg)
      .filter((t) => t.total >= 3 && t.correct / t.total < 0.5)
      .map((t) => ({
        ...t,
        percentage: Math.round((t.correct / t.total) * 100),
      }))
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 10);

    const data: AnalyticsResult = {
      totalTests,
      averageScore: Math.round(averageScore * 100) / 100,
      bestScore: Math.round(bestScore * 100) / 100,
      recentTrend,
      subjectPerformance,
      weakTopics,
    };

    void this.cache.set(KEY, data, CACHE_TTL);
    return data;
  }

  async recordVisit(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    await this.prisma.siteVisit.upsert({
      where: { date },
      create: { date, count: 1 },
      update: { count: { increment: 1 } },
    });
  }
}
