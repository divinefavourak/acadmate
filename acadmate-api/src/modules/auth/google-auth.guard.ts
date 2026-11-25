import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { resolveReturnOrigin } from '../../common/utils/allowed-origins';

/**
 * Google OAuth guard that remembers which frontend started the sign-in.
 *
 * GET /api/auth/google?returnTo=https://beta.acadmate.com.ng puts that origin in
 * the OAuth `state` parameter. Google echoes `state` back to the callback, which
 * reads it with resolveReturnOrigin() again, so an origin that isn't allowed
 * falls back to FRONTEND_URL at both ends. Requests without returnTo behave as
 * before.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    // Only the start of the flow carries returnTo. On the callback, passport
    // reads `state` from the query itself.
    if (req.query.returnTo === undefined) return {};
    return { state: resolveReturnOrigin(req.query.returnTo) };
  }
}
