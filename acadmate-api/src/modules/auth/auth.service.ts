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

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'STUDENT',
        studentProfile: { create: {} },
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, role: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.issueToken(user);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  async googleLogin(profile: { email: string; name: string; googleId: string }) {
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          role: 'STUDENT',
          studentProfile: { create: {} },
        },
      });
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
