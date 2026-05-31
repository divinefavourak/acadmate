import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /admin/stats — platform stats dashboard (direct port of /api/admin/stats)
  async getPlatformStats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    // UTC-midnight dates built from local components — must match recordVisit's key strategy.
    const toUTCDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const visitDates = last7Days.map(toUTCDay);

    const [
      totalStudents,
      totalQuestions,
      publishedQuestions,
      totalExams,
      totalImports,
      recentExams,
      questionsPerSubject,
      results,
      recentRegistrations,
      siteVisits,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.question.count(),
      this.prisma.question.count({ where: { isPublished: true } }),
      this.prisma.examSession.count(),
      this.prisma.import.count(),
      this.prisma.examSession.findMany({
        take: 200,
        orderBy: { createdAt: 'desc' },
        where: { status: { in: ['SUBMITTED', 'TIMED_OUT'] } },
        select: { createdAt: true },
      }),
      this.prisma.subject.findMany({
        where: { isActive: true },
        select: {
          code: true,
          _count: { select: { questions: { where: { isPublished: true } } } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.result.findMany({
        select: { score: true },
        take: 1000,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: { role: 'STUDENT', createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.siteVisit.findMany({
        where: { date: { in: visitDates } },
        select: { date: true, count: true },
      }),
    ]);

    const siteVisitMap = new Map(siteVisits.map((v) => [v.date.getTime(), v.count]));

    const dailyCounts = last7Days.map((day) => {
      const label = day.toLocaleDateString('en-NG', { weekday: 'short' });
      const count = recentExams.filter((e) => {
        const d = new Date(e.createdAt);
        return (
          d.getDate() === day.getDate() &&
          d.getMonth() === day.getMonth() &&
          d.getFullYear() === day.getFullYear()
        );
      }).length;
      return { label, count };
    });

    const dailyRegistrations = last7Days.map((day) => {
      const label = day.toLocaleDateString('en-NG', { weekday: 'short' });
      const count = recentRegistrations.filter((u) => {
        const d = new Date(u.createdAt);
        return (
          d.getDate() === day.getDate() &&
          d.getMonth() === day.getMonth() &&
          d.getFullYear() === day.getFullYear()
        );
      }).length;
      return { label, count };
    });

    const dailyVisits = last7Days.map((day) => ({
      label: day.toLocaleDateString('en-NG', { weekday: 'short' }),
      count: siteVisitMap.get(toUTCDay(day).getTime()) ?? 0,
    }));

    const questionsBySubject = questionsPerSubject
      .map((s) => ({ subject: s.code, questions: s._count.questions }))
      .filter((s) => s.questions > 0)
      .sort((a, b) => b.questions - a.questions)
      .slice(0, 20);

    // Score distribution across 5 bands
    const bands = [
      { label: '0–20%', min: 0, max: 20 },
      { label: '21–40%', min: 21, max: 40 },
      { label: '41–60%', min: 41, max: 60 },
      { label: '61–80%', min: 61, max: 80 },
      { label: '81–100%', min: 81, max: 100 },
    ];
    const scoreDistribution = bands.map(({ label, min, max }) => ({
      label,
      count: results.filter((r) => r.score >= min && r.score <= max).length,
    }));

    return {
      totalStudents,
      totalQuestions,
      publishedQuestions,
      totalExams,
      totalImports,
      dailyExamActivity: dailyCounts,
      dailyRegistrations,
      dailyVisits,
      questionsBySubject,
      scoreDistribution,
    };
  }
}
