import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { MAX_REWARDED_REFERRALS, REFERRAL_BONUS } from '../quota/quota.service';

// Unambiguous characters (no 0/O, 1/I/L) so a code read aloud still works.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
// Only a new account can be credited to a friend, so an old account can't
// claim a code later by re-running onboarding.
const CLAIM_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function newReferralCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

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
      /** A friend's referral code, from their invite link. */
      referralCode?: string;
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

    // The referral is credited in the same transaction as onboarding, so if
    // either fails neither is saved and the student can simply submit again.
    const referrerId = await this.prisma.$transaction(async (tx) => {
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
      return dto.referralCode ? this.claimReferral(tx, userId, dto.referralCode) : null;
    });

    if (referrerId) this.events.record('referral_signup', userId, { referrerId });
    return this.getMe(userId);
  }

  // ─── Referrals ─────────────────────────────────────────────────────────────

  /**
   * Credits a new student to the friend who invited them. Quietly does
   * nothing for an unknown code, the student's own code, an account that
   * already has a referrer, or one older than the claim window.
   */
  /** Returns the referrer's id when this call credited them, else null. */
  private async claimReferral(tx: Prisma.TransactionClient, userId: string, rawCode: string): Promise<string | null> {
    const code = rawCode.trim().toUpperCase().slice(0, 16);
    if (!code) return null;
    const referrer = await tx.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!referrer || referrer.id === userId) return null;
    const { count } = await tx.user.updateMany({
      where: {
        id: userId,
        referredById: null,
        createdAt: { gte: new Date(Date.now() - CLAIM_WINDOW_MS) },
      },
      data: { referredById: referrer.id },
    });
    return count === 1 ? referrer.id : null;
  }

  /** The student's invite code (made on first request) and what it has earned. */
  async getReferral(userId: string) {
    let user = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
    if (!user) throw new NotFoundException('User not found');
    for (let attempt = 0; !user.referralCode && attempt < 5; attempt++) {
      try {
        // Only while it's still empty: two first requests at once must not
        // each write a code, leaving one response with a code that isn't saved.
        await this.prisma.user.updateMany({
          where: { id: userId, referralCode: null },
          data: { referralCode: newReferralCode() },
        });
      } catch (err) {
        // Code already taken by someone else: try another.
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }
      user = (await this.prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } })) ?? user;
    }
    if (!user.referralCode) throw new ConflictException('Could not make an invite code. Try again.');

    const [signedUp, joined] = await Promise.all([
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.user.count({ where: { referredById: userId, onboardedAt: { not: null } } }),
    ]);
    const rewarded = Math.min(joined, MAX_REWARDED_REFERRALS);
    return {
      code: user.referralCode,
      path: `/register?ref=${user.referralCode}`,
      signedUp,
      joined,
      rewarded,
      bonusQuestions: rewarded * REFERRAL_BONUS,
      perFriend: REFERRAL_BONUS,
      maxFriends: MAX_REWARDED_REFERRALS,
    };
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
    this.events.record('premium_granted', userId, { via: 'code' });

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
