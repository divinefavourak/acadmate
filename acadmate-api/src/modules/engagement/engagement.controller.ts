import { Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { EngagementService } from './engagement.service';
import { isValidUnsubscribeToken } from '../../common/utils/unsubscribe-token';
import { frontendUrl } from '../auth/email-templates';

const page = (title: string, text: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Acadmate</title></head>
<body style="margin:0;background:#f4f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b">
<main style="max-width:480px;margin:12vh auto;padding:28px 24px;background:#fff;border-radius:12px">
<p style="margin:0 0 8px;font-weight:800;font-size:20px;color:#0d1d2f">Acadmate</p>
<h1 style="font-size:22px;margin:16px 0 8px">${title}</h1>
<p style="line-height:1.6;margin:0 0 20px">${text}</p>
<a href="${frontendUrl('/')}" style="color:#0874d4;font-weight:600">Go to Acadmate</a>
</main></body></html>`;

/**
 * Unsubscribe from practice reminders. GET is the link in the email; POST is the
 * one-click unsubscribe (RFC 8058) that Gmail and other clients send when the
 * reader uses their own unsubscribe button. No sign-in: the signed token is
 * the proof.
 */
@ApiTags('email')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('email/unsubscribe')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get()
  @ApiOperation({ summary: 'Unsubscribe from reminder emails (link in the email)' })
  async viaLink(@Query('u') userId: unknown, @Query('t') token: unknown, @Res() res: Response) {
    res.type('html');
    if (!isValidUnsubscribeToken(userId, token)) {
      return res
        .status(400)
        .send(page('This link isn’t valid', 'It may have been cut off when it was copied. Use the link in the email itself, or message us on WhatsApp and we’ll stop the reminders for you.'));
    }
    await this.engagement.unsubscribe(userId);
    return res.send(page('You won’t get reminders any more', 'We’ve stopped practice reminder emails for your account. You’ll still get emails you ask for, like password resets.'));
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'One-click unsubscribe (RFC 8058)' })
  async oneClick(@Query('u') userId: unknown, @Query('t') token: unknown) {
    if (isValidUnsubscribeToken(userId, token)) await this.engagement.unsubscribe(userId);
    // Always 200: one-click senders don't show errors, and this reveals nothing about which ids exist.
    return { ok: true };
  }
}
