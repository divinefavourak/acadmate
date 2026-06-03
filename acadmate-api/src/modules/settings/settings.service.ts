import { Injectable } from '@nestjs/common';
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

// Fail open: if nothing has ever been configured, everything is available.
const DEFAULT_EXAM_AVAILABILITY: ExamAvailability = { utme: true, postUtme: true };

@Injectable()
export class SettingsService {
  // Short TTL so an admin toggle propagates to every instance within a minute,
  // while still sparing the DB on the hot exam-creation path.
  private readonly cacheKey = 'settings:exam_availability';
  private readonly cacheTtlSeconds = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getExamAvailability(): Promise<ExamAvailability> {
    const cached = await this.cache.get<ExamAvailability>(this.cacheKey);
    if (cached) return cached;

    const row = await this.prisma.appSetting.findUnique({
      where: { key: EXAM_AVAILABILITY_KEY },
    });
    const value = this.normalize(row?.value);
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
}
