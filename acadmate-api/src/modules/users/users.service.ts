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

    // English, Maths and General Knowledge are compulsory and added automatically
    // at exam time; the student picks 2–3 electives beyond those.
    const uniqueIds = [...new Set(utmeSubjectIds)];
    if (uniqueIds.length < 2 || uniqueIds.length > 3) {
      throw new BadRequestException('Please select 2 or 3 elective subjects.');
    }
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true, code: true },
    });
    if (subjects.length !== uniqueIds.length) {
      throw new BadRequestException('One or more selected subjects are invalid.');
    }
    if (subjects.some((s) => ['ENG', 'MTH', 'GEN'].includes(s.code))) {
      throw new BadRequestException(
        'English, Mathematics and General Knowledge are compulsory and added automatically — please pick other electives.',
      );
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

      await this.syncUtmeSubjects(tx, profile.id, uniqueIds);
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

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.accessToken.updateMany({
        where: { id: token.id, usedById: null, revokedAt: null },
        data: { usedById: userId, usedAt: new Date() },
      });
      if (count === 0) {
        const current = await tx.accessToken.findUnique({ where: { id: token.id }, select: { revokedAt: true } });
        if (current?.revokedAt) throw new BadRequestException('This access code has been revoked. Please contact support.');
        throw new BadRequestException('This access code has already been used.');
      }
      await tx.user.update({ where: { id: userId }, data: { plan: 'PREMIUM' } });
    });

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
