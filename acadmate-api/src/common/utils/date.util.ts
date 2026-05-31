/**
 * Returns the UTC-midnight Date for the given UTC calendar day.
 * Both SiteVisit writes (recordVisit) and reads (admin stats) must use this
 * function so the stored Postgres date key always matches the query key.
 * Using UTC getters ensures consistent bucketing regardless of server timezone.
 */
export function toUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
