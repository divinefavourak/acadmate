import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminSubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Subjects ─────────────────────────────────────────────────────────────
  async listSubjects() {
    return this.prisma.subject.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, code: true, description: true,
        isActive: true, sortOrder: true, createdAt: true,
        _count: { select: { questions: true, topics: true } },
      },
    });
  }

  async createSubject(dto: {
    name: string; code: string; description?: string;
    isActive?: boolean; sortOrder?: number;
  }) {
    return this.prisma.subject.create({
      data: { ...dto, code: dto.code.toUpperCase() },
    });
  }

  async updateSubject(id: string, dto: Partial<{
    name: string; code: string; description: string;
    isActive: boolean; sortOrder: number;
  }>) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.prisma.subject.update({ where: { id }, data: dto });
  }

  async deleteSubject(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    await this.prisma.subject.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Topics ───────────────────────────────────────────────────────────────
  async listTopics(subjectId?: string) {
    return this.prisma.topic.findMany({
      where: subjectId ? { subjectId } : undefined,
      orderBy: [{ subjectId: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true, name: true, description: true, isActive: true,
        sortOrder: true, subjectId: true,
        subject: { select: { name: true } },
        _count: { select: { questions: true } },
      },
    });
  }

  async createTopic(dto: {
    subjectId: string; name: string; description?: string;
    isActive?: boolean; sortOrder?: number;
  }) {
    return this.prisma.topic.create({ data: dto });
  }

  async updateTopic(id: string, dto: Partial<{
    name: string; description: string; isActive: boolean; sortOrder: number;
  }>) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) throw new NotFoundException('Topic not found');
    return this.prisma.topic.update({ where: { id }, data: dto });
  }

  async deleteTopic(id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) throw new NotFoundException('Topic not found');
    await this.prisma.topic.delete({ where: { id } });
    return { deleted: true };
  }
}
