import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

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

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private ready = false;

  onModuleInit() {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.SMTP_FROM ?? 'Acadmate <noreply@acadmate.app>';
    if (!apiKey) {
      this.logger.warn('SENDGRID_API_KEY not set — emails will fail to send');
      return;
    }
    sgMail.setApiKey(apiKey);
    this.ready = true;
    this.logger.log(
      `SendGrid configured: from="${from}", key=…${apiKey.slice(-4)}`,
    );
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    if (!this.ready) {
      this.logger.warn(`Skipping password reset email to ${to} — SendGrid not configured`);
      return;
    }
    const from = process.env.SMTP_FROM ?? 'Acadmate <noreply@acadmate.app>';

    try {
      await sgMail.send({
        from,
        to,
        subject: 'Reset your Acadmate password',
        html: `
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
        `,
      });
    } catch (err) {
      const sgErrors = (err as any)?.response?.body?.errors;
      const detail = sgErrors ? JSON.stringify(sgErrors) : (err as Error).message;
      this.logger.error(`Failed to send password reset email to ${to}: ${detail}`, (err as Error).stack);
      throw err;
    }
  }

  async sendBlogNotification(
    to: string,
    recipientName: string | null,
    post: BlogPostForEmail,
  ) {
    if (!this.ready) {
      this.logger.warn(`Skipping blog notification to ${to} — SendGrid not configured`);
      return;
    }
    const from = process.env.SMTP_FROM ?? 'Acadmate <noreply@acadmate.app>';
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
      this.logger.log(`Sending blog notification to ${to} — "${post.title}"`);
      await sgMail.send({
        from,
        to,
        subject: `New on Acadmate: ${post.title}`,
        html: `
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
        `,
      });
      this.logger.log(`Blog notification sent to ${to} — "${post.title}"`);
    } catch (err) {
      const sgErrors = (err as any)?.response?.body?.errors;
      const detail = sgErrors ? JSON.stringify(sgErrors) : (err as Error).message;
      this.logger.error(
        `Failed to send blog notification to ${to}: ${detail}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
