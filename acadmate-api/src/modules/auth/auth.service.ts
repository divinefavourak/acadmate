import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { normalizePhone, looksLikePhone } from '../../common/utils/phone.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // ─── Register ────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    // Optional phone — normalised to E.164 and uniqueness-checked so it can be
    // used as an alternate login identifier.
    let phone: string | null = null;
    if (dto.phone?.trim()) {
      phone = normalizePhone(dto.phone);
      const phoneTaken = await this.prisma.user.findUnique({ where: { phone } });
      if (phoneTaken) throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone,
        passwordHash,
        role: 'STUDENT',
        studentProfile: { create: {} },
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  // ─── Login (by email or phone) ─────────────────────────────────────────────
  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim();
    const where = looksLikePhone(identifier)
      ? { phone: normalizePhone(identifier) }
      : { email: identifier };

    const user = await this.prisma.user.findUnique({
      where,
      select: { id: true, name: true, email: true, role: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  async googleLogin(profile: {
    email: string;
    name: string;
    googleId: string;
    image?: string;
  }) {
    const image = profile.image ?? null;
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
      include: {
        studentProfile: { select: { avatarUrl: true, avatarConfig: true } },
      },
    });

    if (!user) {
      // First sign-in: seed both the auth-level image and the profile avatar from
      // the Google account picture.
      user = await this.prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          image,
          role: 'STUDENT',
          studentProfile: { create: { avatarUrl: image } },
        },
        include: {
          studentProfile: { select: { avatarUrl: true, avatarConfig: true } },
        },
      });
    } else if (image) {
      // Returning user: only adopt the Google picture if they haven't chosen
      // their own avatar yet, so we never clobber a custom one.
      const hasCustomAvatar =
        !!user.studentProfile?.avatarUrl || !!user.studentProfile?.avatarConfig;
      if (!hasCustomAvatar) {
        await this.prisma.studentProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, avatarUrl: image },
          update: { avatarUrl: image },
        });
      }
      if (!user.image) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { image },
        });
      }
    }

    return this.issueToken(user);
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return { ok: true };

    // Delete any existing reset token for this email
    await this.prisma.verificationToken.deleteMany({ where: { identifier: email } });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset(email, resetUrl);
    return { ok: true };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.verificationToken.findUnique({ where: { token } });

    if (!record) throw new BadRequestException('Invalid or expired reset link');
    if (record.expires < new Date()) {
      await this.prisma.verificationToken.delete({ where: { token } });
      throw new BadRequestException('Reset link has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { email: record.identifier },
      data: { passwordHash },
    });

    await this.prisma.verificationToken.delete({ where: { token } });
    return { ok: true };
  }

  // Used by GET /auth/token so the frontend can relay a token to its own domain cookie
  // after Google OAuth (where the JWT only lands in the backend's HttpOnly cookie).
  async reissueToken(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private async issueToken(user: { id: string; name: string | null; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }
}
