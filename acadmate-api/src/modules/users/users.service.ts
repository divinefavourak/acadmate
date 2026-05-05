import { Injectable, NotFoundException } from '@nestjs/common';
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
    },
  ) {
    const { name, ...profileData } = dto;

    await this.prisma.$transaction([
      ...(name
        ? [this.prisma.user.update({ where: { id: userId }, data: { name } })]
        : []),
      ...(Object.keys(profileData).length > 0
        ? [
            this.prisma.studentProfile.upsert({
              where: { userId },
              create: { userId, ...profileData },
              update: profileData,
            }),
          ]
        : []),
    ]);

    return this.getMe(userId);
  }
}
