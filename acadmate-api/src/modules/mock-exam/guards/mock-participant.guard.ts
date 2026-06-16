import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface MockParticipantPayload {
  sub: string;       // participantId
  mockExamId: string;
  type: 'MOCK_PARTICIPANT';
}

@Injectable()
export class MockParticipantGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const auth: string | undefined = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();

    try {
      const payload = this.jwt.verify<MockParticipantPayload>(auth.slice(7), {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (payload.type !== 'MOCK_PARTICIPANT') throw new UnauthorizedException();
      req.mockParticipant = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
