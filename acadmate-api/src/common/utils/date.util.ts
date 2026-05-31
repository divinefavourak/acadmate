/**
 * Returns the UTC-midnight Date for the given local calendar day.
 * Both SiteVisit writes (recordVisit) and reads (admin stats) must use this
 * function so the stored Postgres date key always matches the query key.
 */
export function toUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
