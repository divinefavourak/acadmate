import {
  Controller, Post, Get, Body, HttpCode, HttpStatus,
  Res, UseGuards, Req, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

class ForgotPasswordDto {
  @IsEmail() email: string;
}

class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(6) password: string;
}

@ApiTags('auth')
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new student account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a JWT access token' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the session cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('acadmate_token', { path: '/' });
    return { ok: true };
  }

  // ─── Token relay for cross-domain deployments ─────────────────────────────
  // The frontend (Vercel) and backend (Render) are on different domains.
  // After Google OAuth the JWT only exists in the backend's HttpOnly cookie.
  // The frontend calls this endpoint (credentials: 'include') to get a fresh token,
  // then mirrors it to its own domain so Next.js middleware can read it.
  @Get('token')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Re-issue token for frontend cookie relay (cross-domain)' })
  async getToken(@Req() req: Request & { user?: { id: string; email: string; role: string } }) {
    const user = (req as { user?: { id: string; email: string; role: string } }).user;
    if (!user) throw new UnauthorizedException();
    return this.authService.reissueToken(user);
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google OAuth consent screen' })
  googleAuth() { /* Passport handles the redirect */ }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback — issues JWT and redirects to frontend' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as { email: string; name: string; googleId: string };
    const result = await this.authService.googleLogin(profile);

    this.setAuthCookie(res, result.accessToken);

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?role=${result.user.role}`);
  }

  // ─── Password Reset ──────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a valid token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  // ─── Helper ──────────────────────────────────────────────────────────────

  private setAuthCookie(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('acadmate_token', token, {
      httpOnly: true,
      secure: isProduction,
      // SameSite=None required for cross-origin fetch in production (different domains)
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
