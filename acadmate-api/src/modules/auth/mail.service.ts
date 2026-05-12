import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendPasswordReset(to: string, resetUrl: string) {
    const from = process.env.SMTP_FROM ?? 'Acadmate <noreply@acadmate.app>';

    try {
      await this.transporter.sendMail({
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
      this.logger.error(`Failed to send password reset email to ${to}`, err);
      throw err;
    }
  }

  async sendBlogNotification(
    to: string,
    recipientName: string | null,
    post: BlogPostForEmail,
  ) {
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
      await this.transporter.sendMail({
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
    } catch (err) {
      this.logger.warn(`Failed to send blog notification to ${to}`, err as Error);
      throw err;
    }
  }
}
