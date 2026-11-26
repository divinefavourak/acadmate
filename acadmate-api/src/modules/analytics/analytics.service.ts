import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { toUTCDay } from '../../common/utils/date.util';

type TrendPoint  = { id: string; score: number; mode: string; date: Date };
type SubjectPerf = { subjectId: string; name: string; correct: number; total: number; percentage: number };
type WeakTopic   = { topicId: string; subjectId: string | null; name: string; correct: number; total: number; percentage: number };

export interface AnalyticsResult {
  totalTests: number;
  averageScore: number;
  bestScore: number;
  recentTrend: TrendPoint[];
  subjectPerformance: SubjectPerf[];
  weakTopics: WeakTopic[];
  /** All weak topics found. Free accounts get only the first in weakTopics. */
  weakTopicsTotal?: number;
}

// The full weak-topic report is a Premium feature; Free sees the weakest one.
const FREE_WEAK_TOPICS = 1;

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

  /** Analytics as this student may see them: Free gets one weak topic. */
  async getForStudent(userId: string, limit: number = 100): Promise<AnalyticsResult> {
    const [data, user] = await Promise.all([
      this.getStudentAnalytics(userId, limit),
      this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    ]);
    const total = data.weakTopics.length;
    if (user?.plan === 'PREMIUM') return { ...data, weakTopicsTotal: total };
    return { ...data, weakTopics: data.weakTopics.slice(0, FREE_WEAK_TOPICS), weakTopicsTotal: total };
  }

  async getStudentAnalytics(userId: string, limit: number = 100): Promise<AnalyticsResult> {
    // v2: weak topics now carry subjectId.
    const KEY = `analytics:${userId}:${limit}:v2`;

    const cached = await this.cache.get<AnalyticsResult>(KEY);
    if (cached) return cached;

    const results = await this.prisma.result.findMany({
      // Retries are second attempts at questions already seen; leaving them
      // out keeps averages and weak topics honest.
      where: { userId, examSession: { mode: { not: 'RETRY' } } },
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

    const weakList = Object.values(topicAgg)
      .filter((t) => t.total >= 3 && t.correct / t.total < 0.5)
      .map((t) => ({
        ...t,
        percentage: Math.round((t.correct / t.total) * 100),
      }))
      // No cap: Premium's report is every qualifying topic, and the total
      // must count them all. It can't exceed the number of topics there are.
      .sort((a, b) => a.percentage - b.percentage);
    // The subject lets the dashboard link straight to a topic drill.
    const topicSubjects = new Map(
      (
        await this.prisma.topic.findMany({
          where: { id: { in: weakList.map((t) => t.topicId) } },
          select: { id: true, subjectId: true },
        })
      ).map((t) => [t.id, t.subjectId]),
    );
    const weakTopics = weakList.map((t) => ({ ...t, subjectId: topicSubjects.get(t.topicId) ?? null }));

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
    const date = toUTCDay(new Date());
    try {
      await this.prisma.siteVisit.upsert({
        where: { date },
        create: { date, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch (err: unknown) {
      // P2002 = unique constraint — concurrent first-hit of day; fall back to increment
      if ((err as { code?: string }).code === 'P2002') {
        await this.prisma.siteVisit.update({ where: { date }, data: { count: { increment: 1 } } });
      } else {
        throw err;
      }
    }
  }
}
