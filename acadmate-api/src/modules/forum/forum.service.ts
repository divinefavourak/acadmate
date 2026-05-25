import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BlogCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ALLOWED_CATEGORIES: BlogCategory[] = [
  'GENERAL', 'UTME', 'POST_UTME', 'JAMB',
  'SCHOOL_NEWS', 'STUDY_TIPS', 'SCHOLARSHIPS',
];

const AUTHOR_SELECT = { id: true, name: true } as const;

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  async listThreads(opts: { limit: number; offset: number; category?: BlogCategory }) {
    const where = opts.category ? { category: opts.category } : {};
    const [threads, total] = await Promise.all([
      this.prisma.forumThread.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        select: {
          id: true,
          title: true,
          body: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          author: { select: AUTHOR_SELECT },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.forumThread.count({ where }),
    ]);

    return {
      threads: threads.map(({ _count, ...t }) => ({ ...t, replyCount: _count.replies })),
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  async getThread(id: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        author: { select: AUTHOR_SELECT },
        _count: { select: { replies: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: AUTHOR_SELECT },
          },
        },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    const { _count, replies, ...rest } = thread;
    return { thread: { ...rest, replyCount: _count.replies }, replies };
  }

  async createThread(authorId: string, dto: { title: string; body: string; category: BlogCategory }) {
    if (!ALLOWED_CATEGORIES.includes(dto.category)) {
      throw new BadRequestException(`Invalid category: ${dto.category}`);
    }
    const thread = await this.prisma.forumThread.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        category: dto.category,
        authorId,
      },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        author: { select: AUTHOR_SELECT },
      },
    });
    return { thread: { ...thread, replyCount: 0 } };
  }

  async createReply(authorId: string, threadId: string, body: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    const reply = await this.prisma.forumReply.create({
      data: { body: body.trim(), threadId, authorId },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: AUTHOR_SELECT },
      },
    });
    return { reply };
  }
}
