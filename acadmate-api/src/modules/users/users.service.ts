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
        onboardedAt: true,
        createdAt: true,
        studentProfile: {
          select: {
            id: true,
            age: true,
            targetYear: true,
            courseChoice: true,
            institution: true,
            avatarConfig: true,
            avatarUrl: true,
            courseSubjectCombinations: {
              select: {
                subjectId: true,
                subject: { select: { id: true, name: true, code: true } },
              },
            },
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
      age?: number;
      targetYear?: number;
      courseChoice?: string;
      institution?: string;
      avatarConfig?: Record<string, unknown>;
      avatarUrl?: string;
      utmeSubjectIds?: string[];
    },
  ) {
    const { name, avatarConfig, avatarUrl, utmeSubjectIds, ...rest } = dto;

    const jsonConfig = avatarConfig !== undefined
      ? { avatarConfig: avatarConfig as Prisma.InputJsonValue }
      : {};

    // Empty string means "clear the URL" — store as null
    const urlField = avatarUrl !== undefined
      ? { avatarUrl: avatarUrl === '' ? null : avatarUrl }
      : {};

    const createData: Prisma.StudentProfileUncheckedCreateInput = { userId, ...rest, ...jsonConfig, ...urlField };
    const updateData: Prisma.StudentProfileUncheckedUpdateInput = { ...rest, ...jsonConfig, ...urlField };

    const profileChanged =
      Object.keys(updateData).length > 0 || utmeSubjectIds !== undefined;

    await this.prisma.$transaction(async (tx) => {
      if (name) {
        await tx.user.update({ where: { id: userId }, data: { name } });
      }

      if (!profileChanged) return;

      const profile = await tx.studentProfile.upsert({
        where: { userId },
        create: createData,
        update: updateData,
        select: { id: true },
      });

      if (utmeSubjectIds !== undefined) {
        await this.syncUtmeSubjects(tx, profile.id, utmeSubjectIds);
      }
    });

    return this.getMe(userId);
  }

  // POST /users/me/onboarding — first-time onboarding wizard submission
  async completeOnboarding(
    userId: string,
    dto: {
      name?: string;
      age: number;
      institution: string;
      utmeSubjectIds: string[];
      avatarConfig?: Record<string, unknown>;
      avatarUrl?: string;
    },
  ) {
    const { name, age, institution, utmeSubjectIds, avatarConfig, avatarUrl } = dto;

    // Validate the 3 subjects exist, are active, and aren't English (English is implied)
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: utmeSubjectIds }, isActive: true },
      select: { id: true, code: true },
    });

    if (subjects.length !== 3) {
      throw new BadRequestException('Please select 3 valid UTME subjects.');
    }
    if (subjects.some((s) => s.code === 'ENG')) {
      throw new BadRequestException(
        'Use of English is automatically included — please pick 3 other subjects.',
      );
    }
    if (new Set(subjects.map((s) => s.id)).size !== 3) {
      throw new BadRequestException('UTME subjects must be unique.');
    }

    const jsonConfig =
      avatarConfig !== undefined
        ? { avatarConfig: avatarConfig as Prisma.InputJsonValue }
        : {};
    const urlField =
      avatarUrl !== undefined && avatarUrl !== ''
        ? { avatarUrl }
        : {};

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          onboardedAt: new Date(),
          ...(name ? { name } : {}),
        },
      });

      const profile = await tx.studentProfile.upsert({
        where: { userId },
        create: { userId, age, institution, ...jsonConfig, ...urlField },
        update: { age, institution, ...jsonConfig, ...urlField },
        select: { id: true },
      });

      await this.syncUtmeSubjects(tx, profile.id, utmeSubjectIds);
    });

    return this.getMe(userId);
  }

  // Replace the user's UTME subject combination in-place.
  private async syncUtmeSubjects(
    tx: Prisma.TransactionClient,
    studentProfileId: string,
    subjectIds: string[],
  ) {
    await tx.courseSubjectCombination.deleteMany({
      where: { studentProfileId },
    });
    if (subjectIds.length > 0) {
      await tx.courseSubjectCombination.createMany({
        data: subjectIds.map((subjectId) => ({ studentProfileId, subjectId })),
        skipDuplicates: true,
      });
    }
  }

  async deleteMe(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  async redeemToken(userId: string, code: string) {
    const token = await this.prisma.accessToken.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!token) throw new BadRequestException('Invalid access code. Please check and try again.');
    if (token.usedById) throw new BadRequestException('This access code has already been used.');
    if (token.revokedAt) throw new BadRequestException('This access code has been revoked. Please contact support.');

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
