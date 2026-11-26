import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventsService } from '../../events/events.service';

function generateCode(): string {
  // Avoids visually ambiguous chars (0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `ACM-${seg()}-${seg()}`;
}

const TOKEN_LIST_SELECT = {
  id: true,
  code: true,
  note: true,
  createdAt: true,
  usedAt: true,
  revokedAt: true,
  usedBy: { select: { id: true, name: true, email: true } },
  generatedBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AdminTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

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

  /**
   * Make a student Premium after checking their payment receipt. It records a
   * token already redeemed by them, so the grant shows on this page and the
   * usual Revoke button undoes it.
   */
  async grantByEmail(adminId: string, email: string, note?: string) {
    const matches = await this.prisma.user.findMany({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { id: true, name: true, email: true, plan: true },
      take: 2,
    });
    if (matches.length === 0) {
      throw new NotFoundException(`No account uses ${email.trim()}. Ask the student which email they signed up with.`);
    }
    if (matches.length > 1) {
      throw new ConflictException('More than one account matches that email. Type it exactly as the student signed up.');
    }
    const user = matches[0];
    if (user.plan === 'PREMIUM') {
      throw new ConflictException(`${user.email} already has Premium.`);
    }

    const label = `Granted by email${note?.trim() ? `: ${note.trim()}` : ''}`;
    return this.prisma.$transaction(async (tx) => {
      // A student can hold one redeemed token (usedById is unique). If an
      // earlier one was revoked, switch that back on instead of adding another.
      const existing = await tx.accessToken.findUnique({ where: { usedById: user.id } });
      // Same fields as listTokens, so the page can show this token even when
      // it's an old one outside the newest-first list.
      const token = existing
        ? await tx.accessToken.update({
            where: { id: existing.id },
            data: { revokedAt: null, note: existing.note ? `${existing.note} · ${label}` : label },
            select: TOKEN_LIST_SELECT,
          })
        : await tx.accessToken.create({
            data: {
              code: await this.freeCode(tx),
              note: label,
              generatedById: adminId,
              usedById: user.id,
              usedAt: new Date(),
            },
            select: TOKEN_LIST_SELECT,
          });
      await tx.user.update({ where: { id: user.id }, data: { plan: 'PREMIUM' } });
      return { granted: true, user: { id: user.id, name: user.name, email: user.email }, token };
    }).then((r) => {
      this.events.record('premium_granted', user.id, { via: 'grant' });
      return r;
    });
  }

  private async freeCode(tx: Prisma.TransactionClient): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = generateCode();
      if (!(await tx.accessToken.findUnique({ where: { code } }))) return code;
    }
    throw new ConflictException('Could not generate a unique code. Try again.');
  }

  async listTokens(limit = 50, offset = 0) {
    const safeLimit = Math.min(limit, 100);
    const [tokens, total] = await this.prisma.$transaction([
      this.prisma.accessToken.findMany({
        take: safeLimit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: TOKEN_LIST_SELECT,
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

  async revokeToken(tokenId: string) {
    await this.prisma.$transaction(async (tx) => {
      const token = await tx.accessToken.findUnique({ where: { id: tokenId } });
      if (!token) throw new NotFoundException('Token not found');
      if (token.revokedAt) throw new BadRequestException('Token is already revoked');

      const updated = await tx.accessToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
      if (updated.usedById) {
        await tx.user.update({ where: { id: updated.usedById }, data: { plan: 'FREE' } });
      }
    });

    return { revoked: true };
  }

  async reactivateToken(tokenId: string) {
    await this.prisma.$transaction(async (tx) => {
      const token = await tx.accessToken.findUnique({ where: { id: tokenId } });
      if (!token) throw new NotFoundException('Token not found');
      if (!token.revokedAt) throw new BadRequestException('Token is not revoked');

      const updated = await tx.accessToken.update({ where: { id: tokenId }, data: { revokedAt: null } });
      if (updated.usedById) {
        await tx.user.update({ where: { id: updated.usedById }, data: { plan: 'PREMIUM' } });
      }
    });

    return { reactivated: true };
  }
}
