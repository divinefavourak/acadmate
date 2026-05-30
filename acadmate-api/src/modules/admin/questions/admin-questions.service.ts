import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../cache/cache.service';
import { Difficulty, ExamType } from '@prisma/client';

@Injectable()
export class AdminQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ─── Auto-validate after create/update (ported verbatim) ─────────────────
  async autoValidateQuestion(questionId: string) {
    const [correctOption, optionCount] = await Promise.all([
      this.prisma.questionOption.findFirst({
        where: { questionId, isCorrect: true },
        select: { id: true },
      }),
      this.prisma.questionOption.count({ where: { questionId } }),
    ]);

    const issues: string[] = [];
    if (!correctOption) issues.push('no correct answer set');
    if (optionCount > 5) issues.push(`too many options (${optionCount})`);

    if (issues.length > 0) {
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        select: { text: true, subject: { select: { name: true } } },
      });
      const preview = (question?.text ?? '').substring(0, 80);
      const type = !correctOption ? 'NO_CORRECT_ANSWER' : 'TOO_MANY_OPTIONS';
      const message = `[${question?.subject.name ?? 'Unknown'}] ${issues.join(', ')}: "${preview}…"`;

      await this.prisma.$transaction([
        this.prisma.question.update({
          where: { id: questionId },
          data: { isFlagged: true },
        }),
        this.prisma.adminNotification.create({
          data: { type, questionId, message },
        }),
      ]);
    }
  }

  // GET /admin/questions
  async listQuestions(query: {
    subjectId?: string;
    topicId?: string;
    difficulty?: Difficulty;
    examType?: ExamType;
    school?: string;
    year?: number;
    limit?: number;
    offset?: number;
    flagged?: boolean;
    isPublished?: boolean;
  }) {
    const limit = Math.min(query.limit ?? 20, 500);
    const offset = query.offset ?? 0;

    const where: any = {
      ...(query.subjectId && { subjectId: query.subjectId }),
      ...(query.topicId && { topicId: query.topicId }),
      ...(query.difficulty && { difficulty: query.difficulty }),
      ...(query.examType && { examType: query.examType }),
      ...(query.school && { school: query.school }),
      ...(query.isPublished !== undefined && { isPublished: query.isPublished }),
      ...(query.flagged && { isFlagged: true }),
      ...(query.year !== undefined ? { year: query.year } : {}),
    };

    const [questions, total] = await Promise.all([
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
          isPublished: true,
          isFlagged: true,
          flagCount: true,
          aiAssisted: true,
          sourceType: true,
          subject: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
          _count: { select: { options: true } },
        },
        orderBy: [{ isFlagged: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.question.count({ where }),
    ]);

    return { questions, total, limit, offset };
  }

  // GET /admin/questions/:id
  async getQuestion(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        explanation: true,
        subject: true,
        topic: true,
        proseText: { select: { id: true, title: true } },
        questionFlags: {
          select: { id: true, userId: true, resolved: true, createdAt: true },
          take: 20,
        },
      },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  // POST /admin/questions
  async createQuestion(adminId: string, dto: any) {
    const { options, explanation, aiAssistedExplanation, ...questionData } = dto;

    const question = await this.prisma.question.create({
      data: {
        ...questionData,
        options: {
          create: options.map((opt: any, idx: number) => ({
            label: opt.label,
            text: opt.text,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder ?? idx,
          })),
        },
        ...(explanation && {
          explanation: {
            create: { text: explanation, aiAssisted: aiAssistedExplanation ?? false },
          },
        }),
      },
      include: { options: true, explanation: true },
    });

    try {
      await this.prisma.adminActivityLog.create({
        data: { adminId, action: 'CREATE_QUESTION', entityType: 'question', entityId: question.id },
      });
    } catch (logErr) {
      console.error('[AdminQuestionsService] Activity log failed after createQuestion', logErr);
    }

    await this.autoValidateQuestion(question.id);
    await Promise.all([
      this.cache.delByPrefix('questions:browse:'),
      this.cache.delByPrefix('subjects:'), // _count on subjects changes
    ]);
    return question;
  }

  // PATCH /admin/questions/:id
  async updateQuestion(adminId: string, id: string, dto: any) {
    const { options, explanation, aiAssistedExplanation, ...questionData } = dto;

    const question = await this.prisma.question.update({
      where: { id },
      data: questionData,
      include: { options: true, explanation: true },
    });

    try {
      await this.prisma.adminActivityLog.create({
        data: { adminId, action: 'UPDATE_QUESTION', entityType: 'question', entityId: id },
      });
    } catch (logErr) {
      console.error('[AdminQuestionsService] Activity log failed after updateQuestion', logErr);
    }

    await this.autoValidateQuestion(id);
    await Promise.all([
      this.cache.del(`questions:detail:${id}`),
      this.cache.delByPrefix('questions:browse:'),
      this.cache.delByPrefix('subjects:'), // subjectId may have changed — _count on subjects changes
    ]);
    return question;
  }

  // DELETE /admin/questions/:id
  async deleteQuestion(adminId: string, id: string) {
    await this.prisma.question.delete({ where: { id } });
    try {
      await this.prisma.adminActivityLog.create({
        data: { adminId, action: 'DELETE_QUESTION', entityType: 'question', entityId: id },
      });
    } catch (logErr) {
      console.error('[AdminQuestionsService] Activity log failed after deleteQuestion', logErr);
    }
    await Promise.all([
      this.cache.del(`questions:detail:${id}`),
      this.cache.delByPrefix('questions:browse:'),
      this.cache.delByPrefix('subjects:'), // _count on subjects changes
    ]);
    return { deleted: true };
  }

  // PATCH /admin/questions/bulk/publish
  async bulkPublish(adminId: string, ids: string[], isPublished: boolean) {
    const result = await this.prisma.question.updateMany({
      where: { id: { in: ids } },
      data: { isPublished },
    });
    try {
      await this.prisma.adminActivityLog.create({
        data: {
          adminId,
          action: isPublished ? 'BULK_PUBLISH' : 'BULK_UNPUBLISH',
          details: { count: result.count, ids },
        },
      });
    } catch (logErr) {
      console.error('[AdminQuestionsService] Activity log failed after bulkPublish', logErr);
    }
    await Promise.all([
      this.cache.delByPrefix('questions:'),
      this.cache.delByPrefix('subjects:'), // _count on subjects changes
    ]);
    return { updated: result.count };
  }

  // PATCH /admin/questions/:id/publish
  async togglePublish(adminId: string, id: string, isPublished: boolean) {
    const question = await this.prisma.question.update({
      where: { id },
      data: { isPublished },
      select: { id: true, isPublished: true },
    });
    try {
      await this.prisma.adminActivityLog.create({
        data: {
          adminId,
          action: isPublished ? 'PUBLISH_QUESTION' : 'UNPUBLISH_QUESTION',
          entityType: 'question',
          entityId: id,
        },
      });
    } catch (logErr) {
      console.error('[AdminQuestionsService] Activity log failed after togglePublish', logErr);
    }
    await Promise.all([
      this.cache.del(`questions:detail:${id}`),
      this.cache.delByPrefix('questions:browse:'),
      this.cache.delByPrefix('subjects:'), // isPublished changed — _count on subjects changes
    ]);
    return question;
  }

  // PATCH /admin/questions/:id/resolve-flag
  async resolveFlag(adminId: string, questionId: string) {
    await this.prisma.$transaction([
      this.prisma.question.update({
        where: { id: questionId },
        data: { isFlagged: false },
      }),
      this.prisma.questionFlag.updateMany({
        where: { questionId, resolved: false },
        data: { resolved: true, resolvedAt: new Date() },
      }),
    ]);

    try {
      await this.prisma.adminActivityLog.create({
        data: { adminId, action: 'RESOLVE_FLAG', entityType: 'question', entityId: questionId },
      });
    } catch (logErr) {
      console.error('[AdminQuestionsService] Activity log failed after resolveFlag', logErr);
    }

    await this.cache.del(`questions:detail:${questionId}`);
    return { resolved: true };
  }
}
