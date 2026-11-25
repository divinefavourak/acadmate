/**
 * When the new Acadmate goes live. The countdown on the live site's homepage
 * counts down to this. Override it in Vercel with NEXT_PUBLIC_LAUNCH_AT (an ISO
 * date with a time zone) to move the date without a code change, then redeploy.
 *
 * Default: Wednesday 9 December 2026, 9:00 AM West Africa Time (UTC+1).
 */
export const LAUNCH_AT = new Date(process.env.NEXT_PUBLIC_LAUNCH_AT ?? "2026-12-09T09:00:00+01:00");

/** "Wednesday, 9 December at 9:00 am" in Lagos time, for copy and metadata. */
export function launchLabel(): string {
  return LAUNCH_AT.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
