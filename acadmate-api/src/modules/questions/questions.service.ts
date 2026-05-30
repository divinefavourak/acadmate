import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
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

const BROWSE_TTL = 1_800; // 30 min — bust entire prefix on any admin question change
const DETAIL_TTL = 3_600; // 1 h  — bust single key on admin edit

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // GET /questions — public browsing (published only)
  async browseQuestions(query: QuestionQuery) {
    const limit = Math.min(query.limit ?? 20, 500);
    const offset = query.offset ?? 0;

    // Build a deterministic key from every filter param so different filter
    // combinations don't collide. Empty string means "no filter".
    const KEY = [
      'questions:browse',
      query.subjectId ?? '',
      query.topicId ?? '',
      query.difficulty ?? '',
      query.school ?? '',
      query.examType ?? '',
      limit,
      offset,
    ].join(':');

    type BrowseResult = {
      questions: {
        id: string; text: string | null; difficulty: Difficulty; year: number | null;
        school: string | null; examType: ExamType;
        subject: { id: string; name: string; code: string };
        topic: { id: string; name: string } | null;
        options: { id: string; label: string; text: string; sortOrder: number }[];
      }[];
      total: number; limit: number; offset: number;
    };

    const cached = await this.cache.get<BrowseResult>(KEY);
    if (cached) return cached;

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

    const data = { questions, total, limit, offset };
    void this.cache.set(KEY, data, BROWSE_TTL);
    return data;
  }

  // GET /questions/:id — single question with explanation
  async getQuestion(id: string) {
    const KEY = `questions:detail:${id}`;

    type DetailResult = {
      id: string; text: string | null; imageUrl: string | null; difficulty: Difficulty;
      year: number | null;
      subject: { id: string; name: string; code: string };
      topic: { id: string; name: string } | null;
      options: { id: string; label: string; text: string; isCorrect: boolean; sortOrder: number }[];
      explanation: { text: string; aiAssisted: boolean } | null;
    };

    const cached = await this.cache.get<DetailResult>(KEY);
    if (cached) return cached;

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

    void this.cache.set(KEY, question, DETAIL_TTL);
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
