import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Difficulty, ExamType } from '@prisma/client';

export interface QuestionQuery {
  subjectId?: string;
  topicId?: string;
  difficulty?: Difficulty;
  school?: string;
  examType?: ExamType;
  limit?: number;
  offset?: number;
}

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /questions — public browsing (published only)
  async browseQuestions(query: QuestionQuery) {
    const limit = Math.min(query.limit ?? 20, 500);
    const offset = query.offset ?? 0;

    const where = {
      isPublished: true,
      ...(query.subjectId && { subjectId: query.subjectId }),
      ...(query.topicId && { topicId: query.topicId }),
      ...(query.difficulty && { difficulty: query.difficulty }),
      ...(query.school && { school: query.school }),
      ...(query.examType && { examType: query.examType }),
    };

    const [questions, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        take: limit,
        skip: offset,
        select: {
          id: true,
          text: true,
          difficulty: true,
          year: true,
          school: true,
          examType: true,
          subject: { select: { id: true, name: true, code: true } },
          topic: { select: { id: true, name: true } },
          options: {
            select: { id: true, label: true, text: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.count({ where }),
    ]);

    return { questions, total, limit, offset };
  }

  // GET /questions/:id — single question with explanation
  async getQuestion(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id, isPublished: true },
      select: {
        id: true,
        text: true,
        imageUrl: true,
        difficulty: true,
        year: true,
        subject: { select: { id: true, name: true, code: true } },
        topic: { select: { id: true, name: true } },
        options: {
          select: { id: true, label: true, text: true, isCorrect: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        explanation: { select: { text: true, aiAssisted: true } },
      },
    });

    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  // POST /questions/:id/flag — flag a question
  async flagQuestion(userId: string, questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, text: true, subject: { select: { name: true } } },
    });

    if (!question) throw new NotFoundException('Question not found');

    // Upsert flag record (one flag per user per question)
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.questionFlag.upsert({
        where: { questionId_userId: { questionId, userId } },
        create: { questionId, userId },
        update: {},
        select: { id: true },
      }).then(async () => {
        // Recount flags from unique flaggers
        return tx.questionFlag.count({ where: { questionId } });
      }).then((flagCount) => {
        return tx.question.update({
          where: { id: questionId },
          data: { isFlagged: true, flagCount },
        });
      }).then(() => ({ count: 1 }));

      const preview = (question.text ?? '').substring(0, 80);
      await tx.adminNotification.create({
        data: {
          type: 'QUESTION_FLAGGED',
          questionId,
          triggeredById: userId,
          message: `[${question.subject.name}] Flagged by student: "${preview}…"`,
        },
      });
      return { count };
    });

    return { flagged: true, questionId };
  }
}
