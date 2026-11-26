import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { lagosDay, lagosDayStart, previousDay } from '../../common/utils/lagos-day.util';

// Steps a student takes towards paying, in funnel order. Server-side events
// are recorded where they happen; the client ones arrive via POST /api/events
// and must be in CLIENT_EVENTS.
export const FUNNEL_STEPS = [
  { name: 'signup', label: 'Signed up' },
  { name: 'exam_start', label: 'Started an exam' },
  { name: 'exam_finish', label: 'Finished an exam' },
  { name: 'quota_hit', label: 'Hit a Premium wall' },
  { name: 'upgrade_view', label: 'Opened the Premium page' },
  { name: 'paid_click', label: 'Tapped "I\'ve paid"' },
  { name: 'premium_granted', label: 'Got Premium' },
] as const;

/** Events the browser may record (anything else is rejected). */
export const CLIENT_EVENTS = ['upgrade_view', 'upgrade_click', 'paid_click', 'ask_click', 'share_click', 'invite_click'] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

export type EventName =
  | (typeof FUNNEL_STEPS)[number]['name']
  | ClientEvent
  | 'referral_signup';

type Props = Record<string, string | number | boolean | null>;


@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget. Never awaited by callers and never throws, so a failed
   * write can't break signup, an exam start or a payment.
   */
  record(name: EventName, userId?: string | null, props?: Props): void {
    this.prisma.funnelEvent
      .create({ data: { name, userId: userId ?? null, props: (props ?? undefined) as Prisma.InputJsonValue | undefined } })
      .catch((err: Error) => this.logger.warn(`Could not record "${name}": ${err.message}`));
  }

  /**
   * The funnel over the last `days` days: distinct students per step, plus a
   * per-day count of every event name for the table under it.
   */
  async report(days: number) {
    // Whole Lagos days, today included: the same window for the totals and
    // the day-by-day rows, so nothing is counted that the table doesn't show.
    const dayKeys: string[] = [lagosDay()];
    while (dayKeys.length < days) dayKeys.push(previousDay(dayKeys[dayKeys.length - 1]));
    const since = lagosDayStart(dayKeys[dayKeys.length - 1]);
    const [byName, daily, upgradeSources] = await Promise.all([
      this.prisma.$queryRaw<{ name: string; users: number; events: number }[]>`
        SELECT name, COUNT(DISTINCT "userId")::int AS users, COUNT(*)::int AS events
        FROM funnel_events
        WHERE "createdAt" >= ${since}
        GROUP BY name
      `,
      this.prisma.$queryRaw<{ day: string; name: string; events: number }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS day,
               name, COUNT(*)::int AS events
        FROM funnel_events
        WHERE "createdAt" >= ${since}
        GROUP BY 1, 2
      `,
      // Which upsell sent students to the Premium page.
      this.prisma.$queryRaw<{ source: string | null; users: number; events: number }[]>`
        SELECT props->>'from' AS source, COUNT(DISTINCT "userId")::int AS users, COUNT(*)::int AS events
        FROM funnel_events
        WHERE "createdAt" >= ${since} AND name = 'upgrade_click'
        GROUP BY 1
        ORDER BY events DESC
      `,
    ]);

    const totals = new Map(byName.map((r) => [r.name, r]));
    const steps = FUNNEL_STEPS.map((s) => ({
      name: s.name,
      label: s.label,
      users: totals.get(s.name)?.users ?? 0,
      events: totals.get(s.name)?.events ?? 0,
    }));
    const others = byName
      .filter((r) => !FUNNEL_STEPS.some((s) => s.name === r.name))
      .sort((a, b) => b.events - a.events);

    const perDay = new Map<string, Record<string, number>>();
    for (const r of daily) {
      const row = perDay.get(r.day) ?? {};
      row[r.name] = r.events;
      perDay.set(r.day, row);
    }

    return {
      days,
      since: since.toISOString(),
      steps,
      others,
      upgradeSources: upgradeSources.map((r) => ({ ...r, source: r.source ?? 'unknown' })),
      daily: dayKeys.map((day) => ({ day, counts: perDay.get(day) ?? {} })),
    };
  }
}
