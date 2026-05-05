import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProseService {
  constructor(private readonly prisma: PrismaService) {}

  async listProse() {
    return this.prisma.proseText.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        author: true,
        year: true,
        summary: true,
        themes: true,
        _count: { select: { questions: true, sections: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async getProseById(id: string) {
    const prose = await this.prisma.proseText.findUnique({
      where: { id, isPublished: true },
      select: {
        id: true,
        title: true,
        author: true,
        year: true,
        summary: true,
        themes: true,
        sections: {
          select: { id: true, title: true, content: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!prose) throw new NotFoundException('Prose text not found');
    return prose;
  }
}
