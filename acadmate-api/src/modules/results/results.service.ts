import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /results — paginated result history
  async listResults(userId: string, limit: number, offset: number) {
    const safeLimit = Math.min(limit, 50);
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

    return { results, total, limit: safeLimit, offset };
  }

  // GET /results/:id — detailed result with normalized breakdown tables
  async getResult(userId: string, resultId: string) {
    const result = await this.prisma.result.findFirst({
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
        // Normalized breakdown tables — no JSON
        subjectBreakdowns: {
          select: { subjectId: true, name: true, correct: true, total: true },
        },
        topicBreakdowns: {
          select: { topicId: true, name: true, correct: true, total: true },
        },
      },
    });

    if (!result) throw new NotFoundException('Result not found');
    return result;
  }
}
