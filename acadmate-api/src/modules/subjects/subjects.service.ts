import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSubjects() {
    return this.prisma.subject.findMany({
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
  }

  async getTopics(subjectId: string) {
    return this.prisma.topic.findMany({
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
  }
}
