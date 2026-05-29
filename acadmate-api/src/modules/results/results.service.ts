import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

const LIST_TTL   = 120;    // 2 min — busted immediately when a new exam is submitted
const DETAIL_TTL = 86_400; // 24 h  — results are immutable once created, no busting needed

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // GET /results — paginated result history
  async listResults(userId: string, limit: number, offset: number) {
    const safeLimit = Math.min(limit, 50);
    const KEY = `results:list:${userId}:${safeLimit}:${offset}`;

    type ListResult = {
      results: {
        id: string; score: number; correct: number; incorrect: number;
        unanswered: number; totalQuestions: number; createdAt: Date;
        examSession: {
          id: string; mode: string; status: string;
          durationMinutes: number; startedAt: Date | null; submittedAt: Date | null;
        };
      }[];
      total: number; limit: number; offset: number;
    };

    const cached = await this.cache.get<ListResult>(KEY);
    if (cached) return cached;

    const [results, total] = await this.prisma.$transaction([
      this.prisma.result.findMany({
        where: { userId },
        take: safeLimit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          score: true,
          correct: true,
          incorrect: true,
          unanswered: true,
          totalQuestions: true,
          createdAt: true,
          examSession: {
            select: {
              id: true,
              mode: true,
              status: true,
              durationMinutes: true,
              startedAt: true,
              submittedAt: true,
            },
          },
        },
      }),
      this.prisma.result.count({ where: { userId } }),
    ]);

    const data = { results, total, limit: safeLimit, offset };
    void this.cache.set(KEY, data, LIST_TTL);
    return data;
  }

  // GET /results/:id — detailed result with normalized breakdown tables
  async getResult(userId: string, resultId: string) {
    const KEY = `results:detail:${resultId}`;

    // Results are immutable — once created they never change.
    // We cache with a long TTL and never need to bust this key.
    const cached = await this.cache.get<Awaited<ReturnType<ResultsService['fetchResult']>>>(KEY);
    if (cached) return cached;

    const result = await this.fetchResult(userId, resultId);
    if (!result) throw new NotFoundException('Result not found');

    void this.cache.set(KEY, result, DETAIL_TTL);
    return result;
  }

  private fetchResult(userId: string, resultId: string) {
    return this.prisma.result.findFirst({
      where: { id: resultId, userId },
      select: {
        id: true,
        score: true,
        correct: true,
        incorrect: true,
        unanswered: true,
        totalQuestions: true,
        createdAt: true,
        examSession: {
          select: {
            id: true,
            mode: true,
            status: true,
            durationMinutes: true,
            startedAt: true,
            submittedAt: true,
            questions: {
              orderBy: { position: 'asc' },
              select: {
                position: true,
                question: {
                  select: {
                    id: true,
                    text: true,
                    imageUrl: true,
                    subject: { select: { id: true, name: true } },
                    topic: { select: { id: true, name: true } },
                    options: {
                      select: { id: true, label: true, text: true, isCorrect: true, sortOrder: true },
                      orderBy: { sortOrder: 'asc' },
                    },
                    explanation: { select: { text: true } },
                  },
                },
              },
            },
            userAnswers: {
              select: { questionId: true, optionId: true, isCorrect: true },
            },
          },
        },
        subjectBreakdowns: {
          select: { subjectId: true, name: true, correct: true, total: true },
        },
        topicBreakdowns: {
          select: { topicId: true, name: true, correct: true, total: true },
        },
      },
    });
  }
}
