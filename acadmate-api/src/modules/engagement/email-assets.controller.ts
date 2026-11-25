import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { EMAIL_LOGO_PNG } from './email-logo';

/**
 * Images for emails. They come from the API, not the frontend, because the API
 * serves both the pre-launch site and beta, so the link works whichever frontend
 * is live. Skips the rate limit: mail image proxies fetch from shared IPs.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('email')
export class EmailAssetsController {
  @Get('logo.png')
  logo(@Res() res: Response) {
    res
      .type('png')
      // helmet defaults this to same-origin, which stops webmail showing the image.
      .set('Cross-Origin-Resource-Policy', 'cross-origin')
      .set('Cache-Control', 'public, max-age=604800, immutable')
      .send(EMAIL_LOGO_PNG);
  }
}
