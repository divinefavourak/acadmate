import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

function generateCode(): string {
  // Avoids visually ambiguous chars (0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `ACM-${seg()}-${seg()}`;
}

@Injectable()
export class AdminTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async generateToken(adminId: string, note?: string) {
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
      const exists = await this.prisma.accessToken.findUnique({ where: { code } });
      if (!exists) break;
    } while (attempts < 10);

    const token = await this.prisma.accessToken.create({
      data: { code: code!, generatedById: adminId, note: note ?? null },
      select: { id: true, code: true, note: true, createdAt: true },
    });

    return { token };
  }

  async listTokens(limit = 50, offset = 0) {
    const safeLimit = Math.min(limit, 100);
    const [tokens, total] = await this.prisma.$transaction([
      this.prisma.accessToken.findMany({
        take: safeLimit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          note: true,
          createdAt: true,
          usedAt: true,
          usedBy: { select: { id: true, name: true, email: true } },
          generatedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.accessToken.count(),
    ]);

    return { tokens, total, limit: safeLimit, offset };
  }

  async deleteToken(tokenId: string) {
    const token = await this.prisma.accessToken.findUnique({ where: { id: tokenId } });
    if (!token) throw new NotFoundException('Token not found');
    if (token.usedById) throw new ConflictException('Cannot delete a token that has already been redeemed');
    await this.prisma.accessToken.delete({ where: { id: tokenId } });
    return { deleted: true };
  }
}
