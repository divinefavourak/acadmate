import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

// Free-plan question limit (see QuotaService). Off until launch, because the
// API is shared with the pre-launch live site, whose frontend predates it.
// While off, free accounts keep the old rule: at most 20 questions a session.
export const FREE_QUOTA_KEY = 'free_quota';

export interface FreeQuotaSettings {
  enabled: boolean;
  /** Distinct questions a free account may see per subject, for life. */
  perSubject: number;
}

export const DEFAULT_FREE_QUOTA: FreeQuotaSettings = { enabled: false, perSubject: 10 };
export const MAX_FREE_PER_SUBJECT = 200;

// How students pay for Premium: a bank transfer, then an "I've paid" message
// on WhatsApp. An admin grants Premium after checking the receipt.
export const PAYMENT_DETAILS_KEY = 'payment_details';

export interface PaymentDetails {
  /** One payment, in naira. Null until the owner sets it. */
  priceNaira: number | null;
  bankName: string;
  accountName: string;
  /** NUBAN, 10 digits, or empty. */
  accountNumber: string;
  /** International format, digits only (2348012345678). */
  whatsappNumber: string;
}

// The WhatsApp number the old upgrade page linked to.
export const DEFAULT_PAYMENT_DETAILS: PaymentDetails = {
  priceNaira: null,
  bankName: '',
  accountName: '',
  accountNumber: '',
  whatsappNumber: '2349031843486',
};

/** True for a real "YYYY-MM-DD" date (not 2027-13-01 or 2027-02-30). */
export function isCalendarDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// The day the next UTME starts, for the dashboard countdown. Set by an admin
// once JAMB announces it; null hides the countdown.
export const UTME_DATE_KEY = 'utme_date';

// Referral contest: who brings in the most friends between two Lagos dates
// wins the prize (paid by hand). `excluded` holds referrers an admin has
// disqualified after checking their friends.
export const REFERRAL_CONTEST_KEY = 'referral_contest';

export interface ReferralContestSettings {
  start: string | null; // "YYYY-MM-DD", first day (Lagos)
  end: string | null; // "YYYY-MM-DD", last day (Lagos), inclusive
  prize: string;
  excluded: string[];
}

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

  // ─── Free-plan question limit ──────────────────────────────────────────────
  // Read on every free exam start, so cached like exam availability. A failed
  // read falls back to the default (off): the old 20-a-session rule, which is
  // safer than blocking students on a DB blip.

  private readonly freeQuotaCacheKey = 'settings:free_quota';

  async getFreeQuota(): Promise<FreeQuotaSettings> {
    const cached = await this.cache.get<FreeQuotaSettings>(this.freeQuotaCacheKey);
    if (cached) return cached;
    let value: FreeQuotaSettings;
    try {
      const row = await this.prisma.appSetting.findUnique({ where: { key: FREE_QUOTA_KEY } });
      value = this.normalizeFreeQuota(row?.value);
    } catch (err) {
      this.logger.warn(`Free-quota lookup failed, using the default: ${(err as Error).message}`);
      return { ...DEFAULT_FREE_QUOTA };
    }
    await this.cache.set(this.freeQuotaCacheKey, value, this.cacheTtlSeconds);
    return value;
  }

  async setFreeQuota(input: Partial<FreeQuotaSettings>): Promise<FreeQuotaSettings> {
    // Merge onto the stored row, never the fail-open read above: after a DB
    // blip that read says "off", and saving just the number would then switch
    // an enabled limit off for good. A failed lookup fails the save instead.
    const row = await this.prisma.appSetting.findUnique({ where: { key: FREE_QUOTA_KEY } });
    const next = this.normalizeFreeQuota({ ...this.normalizeFreeQuota(row?.value), ...input });
    const value = next as unknown as Prisma.InputJsonObject;
    await this.prisma.appSetting.upsert({
      where: { key: FREE_QUOTA_KEY },
      create: { key: FREE_QUOTA_KEY, value },
      update: { value },
    });
    await this.cache.set(this.freeQuotaCacheKey, next, this.cacheTtlSeconds);
    return next;
  }

  private normalizeFreeQuota(raw: unknown): FreeQuotaSettings {
    const v = (raw ?? {}) as Record<string, unknown>;
    const n = typeof v.perSubject === 'number' && Number.isFinite(v.perSubject)
      ? Math.floor(v.perSubject)
      : DEFAULT_FREE_QUOTA.perSubject;
    return {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_FREE_QUOTA.enabled,
      perSubject: Math.min(MAX_FREE_PER_SUBJECT, Math.max(1, n)),
    };
  }

  // ─── Premium payment details ───────────────────────────────────────────────
  // Read by the upgrade page only, so no cache.

  async getPaymentDetails(): Promise<PaymentDetails> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: PAYMENT_DETAILS_KEY } });
    return this.normalizePayment(row?.value);
  }

  async setPaymentDetails(input: Partial<PaymentDetails>): Promise<PaymentDetails> {
    return this.lockedUpdate(PAYMENT_DETAILS_KEY, (raw) => this.normalizePayment({ ...this.normalizePayment(raw), ...input }));
  }

  /**
   * Read, merge and write one setting under a per-key lock, so two saves at
   * the same moment can't each write back a stale copy of the other's field.
   */
  private lockedUpdate<T>(key: string, merge: (stored: unknown) => T): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'setting:' + key}))`;
      const row = await tx.appSetting.findUnique({ where: { key } });
      const next = merge(row?.value);
      const value = next as unknown as Prisma.InputJsonObject;
      await tx.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      return next;
    });
  }

  private normalizePayment(raw: unknown): PaymentDetails {
    const v = (raw ?? {}) as Record<string, unknown>;
    const text = (x: unknown, fallback: string, max = 80) =>
      typeof x === 'string' ? x.trim().slice(0, max) : fallback;
    const digits = (x: unknown, fallback: string) =>
      typeof x === 'string' ? x.replace(/\D/g, '').slice(0, 15) : fallback;
    const d = DEFAULT_PAYMENT_DETAILS;
    const price = typeof v.priceNaira === 'number' && Number.isFinite(v.priceNaira) && v.priceNaira > 0
      ? Math.round(v.priceNaira)
      : null;
    return {
      priceNaira: v.priceNaira === undefined ? d.priceNaira : price,
      bankName: text(v.bankName, d.bankName),
      accountName: text(v.accountName, d.accountName, 120),
      accountNumber: digits(v.accountNumber, d.accountNumber),
      whatsappNumber: digits(v.whatsappNumber, d.whatsappNumber),
    };
  }

  // ─── UTME date (countdown) ─────────────────────────────────────────────────

  async getUtmeDate(): Promise<{ date: string | null }> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: UTME_DATE_KEY } });
    const v = (row?.value ?? {}) as Record<string, unknown>;
    return { date: typeof v.date === 'string' && isCalendarDate(v.date) ? v.date : null };
  }

  async setUtmeDate(date: string | null): Promise<{ date: string | null }> {
    // The DTO checks the shape; this rejects 2027-13-01 or 2027-02-30.
    if (date !== null && !isCalendarDate(date)) {
      throw new BadRequestException('That date doesn’t exist. Use a real date like 2027-04-15.');
    }
    const value = { date } as Prisma.InputJsonObject;
    await this.prisma.appSetting.upsert({
      where: { key: UTME_DATE_KEY },
      create: { key: UTME_DATE_KEY, value },
      update: { value },
    });
    return { date };
  }

  // ─── Referral contest ──────────────────────────────────────────────────────

  async getReferralContest(): Promise<ReferralContestSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: REFERRAL_CONTEST_KEY } });
    return this.normalizeContest(row?.value);
  }

  private normalizeContest(raw: unknown): ReferralContestSettings {
    const v = (raw ?? {}) as Record<string, unknown>;
    const day = (x: unknown) => (typeof x === 'string' && isCalendarDate(x) ? x : null);
    return {
      start: day(v.start),
      end: day(v.end),
      prize: typeof v.prize === 'string' ? v.prize.slice(0, 200) : '',
      excluded: Array.isArray(v.excluded) ? v.excluded.filter((x): x is string => typeof x === 'string').slice(0, 500) : [],
    };
  }

  /** Dates and prize (and the excluded list, for whole-list writes). */
  async setReferralContest(input: Partial<ReferralContestSettings>): Promise<ReferralContestSettings> {
    return this.lockedUpdate(REFERRAL_CONTEST_KEY, (raw) => {
      const next = { ...this.normalizeContest(raw), ...input };
      for (const d of [next.start, next.end]) {
        if (d !== null && !isCalendarDate(d)) throw new BadRequestException('Use real dates like 2026-12-09.');
      }
      if (next.start && next.end && next.end < next.start) {
        throw new BadRequestException('The contest has to end on or after the day it starts.');
      }
      next.prize = (next.prize ?? '').trim().slice(0, 200);
      next.excluded = [...new Set(next.excluded)];
      return next;
    });
  }

  /**
   * Disqualify or reinstate one referrer, inside the setting's lock, so two
   * admins acting at once can't each write back the other's stale list.
   */
  async setContestExcluded(userId: string, excluded: boolean): Promise<ReferralContestSettings> {
    return this.lockedUpdate(REFERRAL_CONTEST_KEY, (raw) => {
      const c = this.normalizeContest(raw);
      const set = new Set(c.excluded);
      if (excluded) set.add(userId);
      else set.delete(userId);
      return { ...c, excluded: [...set] };
    });
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
