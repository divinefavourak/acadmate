import { Injectable, NotFoundException } from '@nestjs/common';
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
    const { name, avatarConfig, ...rest } = dto;

    const jsonConfig = avatarConfig !== undefined
      ? { avatarConfig: avatarConfig as Prisma.InputJsonValue }
      : {};

    const createData: Prisma.StudentProfileUncheckedCreateInput = { userId, ...rest, ...jsonConfig };
    const updateData: Prisma.StudentProfileUncheckedUpdateInput = { ...rest, ...jsonConfig };

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
}
