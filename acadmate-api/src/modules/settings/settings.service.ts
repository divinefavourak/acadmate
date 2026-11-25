import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

// Setting key under which exam-group availability is stored in app_settings.
export const EXAM_AVAILABILITY_KEY = 'exam_availability';

// Which exam *groups* students may currently start.
//   utme     → MOCK, PRACTICE, TOPIC (general published bank)
//   postUtme → POST_UTME (institution past papers)
export interface ExamAvailability {
  utme: boolean;
  postUtme: boolean;
}

// Practice-reminder emails (see EngagementService). Stored under this key so an
// admin can pause them or change the daily batch without a deploy.
export const EMAIL_REMINDERS_KEY = 'email_reminders';

export interface EmailReminderSettings {
  enabled: boolean;
  /** Reminders sent per daily run. Gmail caps the whole account per day
   *  (about 500 on a personal account, 2,000 on Workspace), and blog alerts
   *  and password resets share that allowance, so keep this well below it. */
  dailyLimit: number;
}

export const DEFAULT_EMAIL_REMINDERS: EmailReminderSettings = { enabled: true, dailyLimit: 40 };
export const MAX_REMINDERS_PER_DAY = 300;

// Fail open: if nothing has ever been configured, everything is available.
const DEFAULT_EXAM_AVAILABILITY: ExamAvailability = { utme: true, postUtme: true };

@Injectable()
export class SettingsService {
  // Short TTL so an admin toggle propagates to every instance within a minute,
  // while still sparing the DB on the hot exam-creation path.
  private readonly cacheKey = 'settings:exam_availability';
  private readonly cacheTtlSeconds = 60;
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getExamAvailability(): Promise<ExamAvailability> {
    const cached = await this.cache.get<ExamAvailability>(this.cacheKey);
    if (cached) return cached;

    // Fail open: this read gates every exam start, so a missing app_settings
    // table (e.g. db push hasn't run yet) or a transient DB blip must not block
    // students. Fall back to all-groups-open rather than throwing.
    let value: ExamAvailability;
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: EXAM_AVAILABILITY_KEY },
      });
      value = this.normalize(row?.value);
    } catch (err) {
      this.logger.warn(
        `Exam-availability lookup failed, defaulting to all-open: ${(err as Error).message}`,
      );
      return { ...DEFAULT_EXAM_AVAILABILITY };
    }

    await this.cache.set(this.cacheKey, value, this.cacheTtlSeconds);
    return value;
  }

  async setExamAvailability(
    input: Partial<ExamAvailability>,
  ): Promise<ExamAvailability> {
    const current = await this.getExamAvailability();
    const next = this.normalize({ ...current, ...input });

    const value = next as unknown as Prisma.InputJsonObject;
    await this.prisma.appSetting.upsert({
      where: { key: EXAM_AVAILABILITY_KEY },
      create: { key: EXAM_AVAILABILITY_KEY, value },
      update: { value },
    });
    await this.cache.set(this.cacheKey, next, this.cacheTtlSeconds);
    return next;
  }

  // Coerce arbitrary stored JSON into a well-formed ExamAvailability so a
  // hand-edited or partial row can never crash the exam-creation path.
  private normalize(raw: unknown): ExamAvailability {
    const v = (raw ?? {}) as Record<string, unknown>;
    return {
      utme:
        typeof v.utme === 'boolean' ? v.utme : DEFAULT_EXAM_AVAILABILITY.utme,
      postUtme:
        typeof v.postUtme === 'boolean'
          ? v.postUtme
          : DEFAULT_EXAM_AVAILABILITY.postUtme,
    };
  }

  // ─── Email reminders ───────────────────────────────────────────────────────
  // Read once a day by the reminder job, so no cache.

  async getEmailReminders(): Promise<EmailReminderSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: EMAIL_REMINDERS_KEY } });
    return this.normalizeReminders(row?.value);
  }

  async setEmailReminders(input: Partial<EmailReminderSettings>): Promise<EmailReminderSettings> {
    const next = this.normalizeReminders({ ...(await this.getEmailReminders()), ...input });
    const value = next as unknown as Prisma.InputJsonObject;
    await this.prisma.appSetting.upsert({
      where: { key: EMAIL_REMINDERS_KEY },
      create: { key: EMAIL_REMINDERS_KEY, value },
      update: { value },
    });
    return next;
  }

  private normalizeReminders(raw: unknown): EmailReminderSettings {
    const v = (raw ?? {}) as Record<string, unknown>;
    const limit = typeof v.dailyLimit === 'number' && Number.isFinite(v.dailyLimit) ? Math.floor(v.dailyLimit) : DEFAULT_EMAIL_REMINDERS.dailyLimit;
    return {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_EMAIL_REMINDERS.enabled,
      dailyLimit: Math.min(MAX_REMINDERS_PER_DAY, Math.max(0, limit)),
    };
  }
}
