import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed unsubscribe links for reminder emails. The token is an HMAC of the user
 * id, so a link can only unsubscribe the person it was sent to, and nobody can
 * unsubscribe someone else by guessing ids. It never expires: an old email's link
 * should still work.
 */
function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

export function unsubscribeToken(userId: string): string {
  return createHmac('sha256', secret()).update(`unsubscribe:${userId}`).digest('base64url');
}

export function isValidUnsubscribeToken(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== 'string' || typeof token !== 'string' || !userId || !token) return false;
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The API endpoint that handles both the link and one-click (RFC 8058) unsubscribes. */
export function unsubscribeUrl(userId: string): string {
  const api = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  return `${api}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}
