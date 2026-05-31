import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google } from 'googleapis';

type BlogPostForEmail = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: string;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

type GmailApiError = { errors?: Array<{ message: string }> };

function isGmailApiError(err: unknown): err is GmailApiError {
  return typeof err === 'object' && err !== null && 'errors' in err;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

// Without RFC 2047 encoding, clients fall back to Latin-1 and garble non-ASCII chars.
function encodeRfc2047(text: string): string {
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private ready = false;
  private from = '';
  private gmail: ReturnType<typeof google.gmail> | null = null;

  onModuleInit() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const gmailUser = process.env.GMAIL_USER;
    const from = process.env.SMTP_FROM;

    const missing: string[] = [];
    if (!clientId) missing.push('GOOGLE_CLIENT_ID');
    if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
    if (!refreshToken) missing.push('GMAIL_REFRESH_TOKEN');
    if (!gmailUser) missing.push('GMAIL_USER');
    if (!from) missing.push('SMTP_FROM');

    if (missing.length > 0) {
      this.logger.warn(`Gmail API not fully configured — emails will fail. Missing: ${missing.join(', ')}`);
      return;
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    this.gmail = google.gmail({ version: 'v1', auth });
    this.from = from!;
    this.ready = true;
    this.logger.log(`Gmail API configured: user=${gmailUser}, from="${from}"`);
  }

  private async sendMail(to: string, subject: string, html: string) {
    if (!this.gmail) throw new Error('Gmail API not initialized');

    const raw = [
      `From: ${sanitizeHeader(this.from)}`,
      `To: ${sanitizeHeader(to)}`,
      `Subject: ${encodeRfc2047(sanitizeHeader(subject))}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n');

    await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(raw).toString('base64url') },
    });
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    if (!this.ready) {
      throw new Error('Gmail API is not configured — check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER, SMTP_FROM');
    }

    try {
      await this.sendMail(to, 'Reset your Acadmate password', `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#4f46e5">Reset your password</h2>
          <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
            Reset Password
          </a>
          <p style="color:#64748b;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">Acadmate – UTME Practice Platform</p>
        </div>
      `);
    } catch (err) {
      const detail = isGmailApiError(err)
        ? err.errors?.map((e) => e.message).join('; ')
        : err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send password reset email to ${maskEmail(to)}: ${detail}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  async sendBlogNotification(
    to: string,
    recipientName: string | null,
    post: BlogPostForEmail,
  ) {
    if (!this.ready) {
      throw new Error('Gmail API is not configured — check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER, SMTP_FROM');
    }

    const baseUrl = (process.env.FRONTEND_URL ?? 'https://acadmate.app').replace(/\/$/, '');
    const postUrl = `${baseUrl}/blog/${encodeURIComponent(post.slug)}`;

    const greeting = recipientName ? `Hi ${escapeHtml(recipientName.split(/\s+/)[0])},` : 'Hi,';
    const safeTitle = escapeHtml(post.title);
    const safeExcerpt = escapeHtml(post.excerpt);
    const label = escapeHtml(categoryLabel(post.category));

    const coverHtml = post.coverImageUrl
      ? `<img src="${escapeHtml(post.coverImageUrl)}" alt="" style="width:100%;max-width:560px;border-radius:12px;margin:16px 0;display:block" />`
      : '';

    try {
      this.logger.log(`Sending blog notification to ${maskEmail(to)} — "${post.title}"`);
      await this.sendMail(to, `New on Acadmate: ${post.title}`, `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:8px">
          <p style="color:#475569;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em">${label}</p>
          <h2 style="color:#0f172a;margin:0 0 12px">${safeTitle}</h2>
          <p style="color:#334155;line-height:1.55;margin:0 0 8px">${greeting}</p>
          ${coverHtml}
          <p style="color:#334155;line-height:1.6">${safeExcerpt}</p>
          <a href="${postUrl}"
             style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
            Read the full post
          </a>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px;margin:0">
            You're receiving this because you're a Premium member of Acadmate — news, study tips, scholarships and more, straight to your inbox.
          </p>
        </div>
      `);
      this.logger.log(`Blog notification sent to ${maskEmail(to)} — "${post.title}"`);
    } catch (err) {
      const detail = isGmailApiError(err)
        ? err.errors?.map((e) => e.message).join('; ')
        : err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send blog notification to ${maskEmail(to)}: ${detail}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }
}
