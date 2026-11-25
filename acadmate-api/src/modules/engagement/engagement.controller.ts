import { Controller, Get, Headers, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { EngagementService } from './engagement.service';
import { isValidUnsubscribeToken } from '../../common/utils/unsubscribe-token';
import { escapeHtml, frontendUrl } from '../auth/email-templates';

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} | Acadmate</title></head>
<body style="margin:0;background:#f4f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b">
<main style="max-width:480px;margin:12vh auto;padding:28px 24px;background:#fff;border-radius:12px">
<p style="margin:0 0 8px;font-weight:800;font-size:20px;color:#0d1d2f">Acadmate</p>
<h1 style="font-size:22px;margin:16px 0 8px">${title}</h1>
${body}
</main></body></html>`;

const para = (text: string) => `<p style="line-height:1.6;margin:0 0 20px">${text}</p>`;
const home = `<a href="${frontendUrl('/')}" style="color:#0874d4;font-weight:600">Go to Acadmate</a>`;

const INVALID = page(
  'This link isn’t valid',
  para('It may have been cut off when it was copied. Use the link in the email itself, or message us on WhatsApp and we’ll stop the reminders for you.') + home,
);
const DONE = page(
  'You won’t get these emails any more',
  para('We’ve stopped study letters and practice reminders for your account. You’ll still get emails you ask for, like password resets.') + home,
);

/**
 * Unsubscribe from practice reminders. No sign-in: the signed token is the proof.
 *
 * GET only shows a confirmation page. Email security scanners and link previews
 * open links before the reader does, so a GET that unsubscribed would silently
 * opt people out. The page's button POSTs back here. Mail clients' own one-click
 * unsubscribe (RFC 8058, from the List-Unsubscribe-Post header) also POSTs here.
 */
@ApiTags('email')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('email/unsubscribe')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get()
  @ApiOperation({ summary: 'Confirmation page for the unsubscribe link (changes nothing)' })
  confirm(@Query('u') userId: unknown, @Query('t') token: unknown, @Res() res: Response) {
    res.type('html');
    if (!isValidUnsubscribeToken(userId, token)) return res.status(400).send(INVALID);
    // Post back to this same address; the token stays in the query string.
    const action = `?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(String(token))}`;
    return res.send(
      page(
        'Stop practice reminders?',
        para('We send a study letter now and then, at most once every two weeks. You can stop them here.') +
          `<form method="post" action="${escapeHtml(action)}" style="margin:0 0 20px">
            <button type="submit" style="padding:12px 20px;background:#0874d4;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer">Stop reminders</button>
          </form>` +
          home,
      ),
    );
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Unsubscribe: the confirmation button, or one-click (RFC 8058)' })
  async unsubscribe(
    @Query('u') userId: unknown,
    @Query('t') token: unknown,
    @Headers('accept') accept: string | undefined,
    @Res() res: Response,
  ) {
    const valid = isValidUnsubscribeToken(userId, token);
    if (valid) await this.engagement.unsubscribe(userId);
    // The page's button is a browser form, so answer with a page. One-click senders
    // get JSON, always 200: they show no errors, and this reveals nothing about which ids exist.
    if (accept?.includes('text/html')) return res.status(valid ? 200 : 400).type('html').send(valid ? DONE : INVALID);
    return res.json({ ok: true });
  }
}
