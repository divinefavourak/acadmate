import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

const TTL = 86_400; // 24h — subjects/topics change only when an admin edits them

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async listSubjects() {
    const KEY = 'subjects:list';

    type Row = {
      id: string;
      name: string;
      code: string;
      description: string | null;
      sortOrder: number;
      _count: { questions: number };
    };

    const cached = await this.cache.get<Row[]>(KEY);
    if (cached) return cached;

    const data = await this.prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        sortOrder: true,
        _count: { select: { questions: { where: { isPublished: true } } } },
      },
    });

    void this.cache.set(KEY, data, TTL);
    return data;
  }

  async getTopics(subjectId: string) {
    const KEY = `subjects:topics:${subjectId}`;

    type Row = {
      id: string;
      name: string;
      description: string | null;
      sortOrder: number;
      _count: { questions: number };
    };

    const cached = await this.cache.get<Row[]>(KEY);
    if (cached) return cached;

    const data = await this.prisma.topic.findMany({
      where: { subjectId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        _count: { select: { questions: { where: { isPublished: true } } } },
      },
    });

    void this.cache.set(KEY, data, TTL);
    return data;
  }
}
