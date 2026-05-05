import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FlagsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /flags — student's flagged questions with resolved status
  async getMyFlags(userId: string) {
    const flags = await this.prisma.questionFlag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        resolved: true,
        resolvedAt: true,
        createdAt: true,
        question: {
          select: {
            id: true,
            text: true,
            isFlagged: true,
            year: true,
            subject: { select: { name: true } },
            topic: { select: { name: true } },
          },
        },
      },
    });

    return { flags };
  }
}
