import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../auth/mail.service';
import { SettingsService } from '../settings/settings.service';
import { reminderVariantsFor, type ReminderVariant } from '../auth/email-templates';
import { unsubscribeUrl } from '../../common/utils/unsubscribe-token';

type Plan = 'FREE' | 'PREMIUM';
type Candidate = { id: string; email: string; name: string | null; plan: Plan };

// Who can get a reminder, and how often.
const NEW_USER_GRACE_DAYS = 3; // let new sign-ups settle in first
const INACTIVE_DAYS = 5; // only nudge people who haven't practised lately
const COOLDOWN_DAYS = 14; // at most one reminder a fortnight per person
const FREE_SHARE = 0.8; // most of the batch goes to Free users
const SEND_GAP_MS = 1500; // pace sends so Gmail doesn't see a burst

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export interface ReminderRunResult {
  enabled: boolean;
  picked: number;
  sent: number;
  failed: number;
  stoppedEarly: boolean;
}

/**
 * Occasional practice reminders. Once a day it picks a small random batch of
 * students who have gone quiet and emails each one a short nudge. Random
 * selection plus a fortnight cooldown spreads a small daily allowance over the
 * whole user base, which is the point: Gmail caps sends per day.
 */
@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
  ) {}

  async sendReminderBatch(): Promise<ReminderRunResult> {
    const { enabled, dailyLimit } = await this.settings.getEmailReminders();
    const result: ReminderRunResult = { enabled, picked: 0, sent: 0, failed: 0, stoppedEarly: false };
    if (!enabled || dailyLimit === 0 || !this.mail.isReady || this.running) return result;

    this.running = true;
    try {
      const batch = await this.pickBatch(dailyLimit);
      result.picked = batch.length;
      if (batch.length === 0) return result;

      // Claim the batch before sending, so a crash or a second run can't email
      // the same people twice. A failed send still counts against the cooldown:
      // better to skip someone once than to retry into a quota error every day.
      await this.prisma.user.updateMany({
        where: { id: { in: batch.map((u) => u.id) } },
        data: { lastReminderAt: new Date() },
      });

      for (const user of batch) {
        const variant: ReminderVariant = pick(reminderVariantsFor(user.plan));
        try {
          await this.mail.sendReminder(user.email, user.name, variant, unsubscribeUrl(user.id));
          result.sent++;
        } catch (err) {
          result.failed++;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Reminder failed for user ${user.id}: ${message}`);
          // Out of daily quota: every further send would fail too.
          if (/quota|rate limit|429/i.test(message)) {
            result.stoppedEarly = true;
            break;
          }
        }
        await sleep(SEND_GAP_MS);
      }
      this.logger.log(`Reminders: ${JSON.stringify(result)}`);
      return result;
    } finally {
      this.running = false;
    }
  }

  /** Mostly Free users, some Premium; if one group runs short the other fills the gap. */
  private async pickBatch(limit: number): Promise<Candidate[]> {
    const freeWanted = Math.ceil(limit * FREE_SHARE);
    const free = await this.candidates('FREE', freeWanted);
    const premium = await this.candidates('PREMIUM', limit - free.length);
    const short = limit - free.length - premium.length;
    const topUp = short > 0 ? await this.candidates('FREE', short, free.map((u) => u.id)) : [];
    return [...free, ...topUp, ...premium].slice(0, limit);
  }

  private async candidates(plan: Plan, limit: number, excludeIds: string[] = []): Promise<Candidate[]> {
    if (limit <= 0) return [];
    const exclude = excludeIds.length ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludeIds)})` : Prisma.empty;
    return this.prisma.$queryRaw<Candidate[]>`
      SELECT u.id, u.email, u.name, u.plan::text AS plan
      FROM users u
      WHERE u.role::text = 'STUDENT'
        AND u.plan::text = ${plan}
        AND u."emailOptOut" = false
        AND u.email <> ''
        AND u."createdAt" < now() - make_interval(days => ${NEW_USER_GRACE_DAYS}::int)
        AND (u."lastReminderAt" IS NULL OR u."lastReminderAt" < now() - make_interval(days => ${COOLDOWN_DAYS}::int))
        AND NOT EXISTS (
          SELECT 1 FROM exam_sessions e
          WHERE e."userId" = u.id AND e."createdAt" > now() - make_interval(days => ${INACTIVE_DAYS}::int)
        )
        ${exclude}
      ORDER BY random()
      LIMIT ${limit}`;
  }

  /** Sets the opt-out flag. Returns false for an unknown user. */
  async unsubscribe(userId: string): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({ where: { id: userId }, data: { emailOptOut: true } });
    if (count) this.logger.log(`User ${userId} unsubscribed from reminders`);
    return count > 0;
  }
}
