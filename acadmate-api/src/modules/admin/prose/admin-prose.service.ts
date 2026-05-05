import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminProseService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Prose Texts ──────────────────────────────────────────────────────────
  async listProse() {
    return this.prisma.proseText.findMany({
      orderBy: { title: 'asc' },
      select: {
        id: true, title: true, author: true, year: true,
        isPublished: true, createdAt: true,
        _count: { select: { questions: true, sections: true } },
      },
    });
  }

  async getProseById(id: string) {
    const prose = await this.prisma.proseText.findUnique({
      where: { id },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!prose) throw new NotFoundException('Prose text not found');
    return prose;
  }

  async createProse(dto: {
    title: string; author?: string; year?: number;
    summary?: string; themes?: string; isPublished?: boolean;
  }) {
    return this.prisma.proseText.create({ data: dto });
  }

  async updateProse(id: string, dto: any) {
    const prose = await this.prisma.proseText.findUnique({ where: { id } });
    if (!prose) throw new NotFoundException('Prose text not found');
    return this.prisma.proseText.update({ where: { id }, data: dto });
  }

  async deleteProse(id: string) {
    const prose = await this.prisma.proseText.findUnique({ where: { id } });
    if (!prose) throw new NotFoundException('Prose text not found');
    await this.prisma.proseText.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Prose Sections ───────────────────────────────────────────────────────
  async addSection(proseTextId: string, dto: {
    title: string; content: string; sortOrder?: number;
  }) {
    const prose = await this.prisma.proseText.findUnique({ where: { id: proseTextId } });
    if (!prose) throw new NotFoundException('Prose text not found');
    return this.prisma.proseSection.create({ data: { proseTextId, ...dto } });
  }

  async updateSection(proseTextId: string, sectionId: string, dto: any) {
    return this.prisma.proseSection.update({
      where: { id: sectionId, proseTextId },
      data: dto,
    });
  }

  async deleteSection(proseTextId: string, sectionId: string) {
    await this.prisma.proseSection.delete({ where: { id: sectionId, proseTextId } });
    return { deleted: true };
  }
}
