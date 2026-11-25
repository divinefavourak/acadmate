/**
 * Frontend origins this API serves: the live site and, before launch, the beta
 * subdomain. The same ALLOWED_ORIGINS variable drives CORS (main.ts) and where
 * Google sign-in may send a user back to (auth.controller.ts).
 *
 * Set ALLOWED_ORIGINS as a comma-separated list, for example
 *   ALLOWED_ORIGINS=https://acadmate.com.ng,https://beta.acadmate.com.ng
 * Falls back to FRONTEND_URL, then to the local dev server.
 */
export function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
  return raw
    .split(',')
    .map((o) => normalise(o))
    .filter((o): o is string => Boolean(o));
}

/** The default frontend: where users go when no valid return origin was given. */
export function defaultFrontendUrl(): string {
  return normalise(process.env.FRONTEND_URL ?? '') ?? allowedOrigins()[0];
}

/**
 * `candidate` if it is exactly one of the allowed origins, else the default
 * frontend. The Google callback puts a login token in the redirect, so this
 * must never send anyone to an origin that isn't on the list.
 */
export function resolveReturnOrigin(candidate: unknown): string {
  if (typeof candidate === 'string') {
    const origin = normalise(candidate);
    if (origin && allowedOrigins().includes(origin)) return origin;
  }
  return defaultFrontendUrl();
}

/** "https://Beta.Acadmate.com.ng/" → "https://beta.acadmate.com.ng". null if not an http(s) origin. */
function normalise(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
