// Calendar days in Lagos time (WAT, UTC+1 all year, no daylight saving).
// Students' "today" for the daily challenge and streaks is a Lagos day.

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for the Lagos day containing `date`. */
export function lagosDay(date: Date = new Date()): string {
  return new Date(date.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant a Lagos day starts (its midnight), as a UTC Date. */
export function lagosDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - LAGOS_OFFSET_MS);
}

/** The day before a "YYYY-MM-DD" day. */
export function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the week containing `day`, as "YYYY-MM-DD". Weeks run Mon–Sun. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

export interface Streak {
  /** Days in a row with a finished exam. Frozen days keep it alive but don't add. */
  current: number;
  /** Whether today already counts. If not, the streak is still alive until midnight. */
  activeToday: boolean;
  /** Missed days a streak freeze covered, newest first. */
  frozenDays: string[];
  /** Whether this week's freeze has been used (only meaningful with freezes on). */
  freezeUsedThisWeek: boolean;
}

/**
 * Current streak from the set of Lagos days with a finished exam.
 *
 * Today doesn't break a streak: it's still open. With `freezes` on (Premium),
 * one missed day per Mon–Sun week is forgiven, but only when the day before
 * it was active, so a freeze is never spent on a streak that had already
 * ended.
 */
export function computeStreak(activeDays: Set<string>, today: string, freezes: boolean): Streak {
  const activeToday = activeDays.has(today);
  const frozenDays: string[] = [];
  const weeksFrozen = new Set<string>();
  let current = 0;
  let day = activeToday ? today : previousDay(today);

  for (let i = 0; i < 800; i++) {
    if (activeDays.has(day)) {
      current++;
    } else if (
      freezes &&
      !weeksFrozen.has(weekStart(day)) &&
      activeDays.has(previousDay(day))
    ) {
      weeksFrozen.add(weekStart(day));
      frozenDays.push(day);
    } else {
      break;
    }
    day = previousDay(day);
  }

  return {
    current,
    activeToday,
    frozenDays,
    freezeUsedThisWeek: weeksFrozen.has(weekStart(today)),
  };
}
