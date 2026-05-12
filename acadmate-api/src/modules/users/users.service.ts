import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /users/me — mirrors /api/me
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
        studentProfile: {
          select: {
            id: true,
            targetYear: true,
            courseChoice: true,
            institution: true,
            avatarConfig: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // PATCH /users/me — update student profile
  async updateMe(
    userId: string,
    dto: {
      name?: string;
      targetYear?: number;
      courseChoice?: string;
      institution?: string;
      avatarConfig?: Record<string, unknown>;
      avatarUrl?: string;
    },
  ) {
    const { name, avatarConfig, avatarUrl, ...rest } = dto;

    const jsonConfig = avatarConfig !== undefined
      ? { avatarConfig: avatarConfig as Prisma.InputJsonValue }
      : {};

    // Empty string means "clear the URL" — store as null
    const urlField = avatarUrl !== undefined
      ? { avatarUrl: avatarUrl === '' ? null : avatarUrl }
      : {};

    const createData: Prisma.StudentProfileUncheckedCreateInput = { userId, ...rest, ...jsonConfig, ...urlField };
    const updateData: Prisma.StudentProfileUncheckedUpdateInput = { ...rest, ...jsonConfig, ...urlField };

    await this.prisma.$transaction([
      ...(name
        ? [this.prisma.user.update({ where: { id: userId }, data: { name } })]
        : []),
      ...(Object.keys(updateData).length > 0
        ? [
            this.prisma.studentProfile.upsert({
              where: { userId },
              create: createData,
              update: updateData,
            }),
          ]
        : []),
    ]);

    return this.getMe(userId);
  }

  async deleteMe(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  async redeemToken(userId: string, code: string) {
    const token = await this.prisma.accessToken.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!token) throw new BadRequestException('Invalid access code. Please check and try again.');
    if (token.usedById) throw new BadRequestException('This access code has already been used.');

    await this.prisma.$transaction([
      this.prisma.accessToken.update({
        where: { id: token.id },
        data: { usedById: userId, usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { plan: 'PREMIUM' },
      }),
    ]);

    return { success: true, message: 'Access code redeemed successfully! You now have Premium access.' };
  }

  async getMyPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return { plan: user.plan };
  }
}
