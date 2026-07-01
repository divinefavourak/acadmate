// Token lives in memory for the current tab session.
// After any auth event the token is also mirrored via /api/auth/set-cookie so that
// Next.js middleware (which runs on the Vercel domain) can read it for route protection.
// The NestJS backend independently sets its own HttpOnly cookie on the Render domain so
// that cross-origin API calls (credentials: 'include') stay authenticated.
let _memoryToken: string | null = null;

export function getToken(): string | null {
  return _memoryToken;
}

export function setToken(token: string): void {
  _memoryToken = token;
}

export function removeToken(): void {
  _memoryToken = null;
}

// Restores the in-memory token from the frontend-domain HttpOnly cookie after a
// cold page load. Essential for pages that make authenticated calls but don't
// live under <UserProvider> (e.g. the public /live/[code] join page): without a
// rehydrated Bearer token, browsers that block cross-site cookies (Brave, Safari
// ITP) can't authenticate the cross-origin API request via credentials alone.
// Resolves to the token if one is available, else null. Safe to call repeatedly.
export async function ensureToken(): Promise<string | null> {
  const existing = getToken();
  if (existing) return existing;
  try {
    const res = await fetch('/api/auth/token');
    if (!res.ok) return null;
    const { token } = (await res.json()) as { token: string };
    setToken(token);
    return token;
  } catch {
    return null;
  }
}

// Mirrors the JWT as an HttpOnly cookie on the frontend (Vercel) domain.
// Must be called after every login/OAuth event so middleware can see the token.
export class RelayError extends Error {
  constructor(status: number) {
    super(`Session cookie could not be set (${status}). Ensure JWT_SECRET matches between frontend and backend.`);
    this.name = 'RelayError';
  }
}

// Mirrors the JWT as an HttpOnly cookie on the frontend (Vercel) domain.
// Must be called after every login/OAuth event so middleware can see the token.
export async function relayTokenToFrontend(token: string): Promise<void> {
  try {
    const res = await fetch('/api/auth/set-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new RelayError(res.status);
  } catch (err) {
    if (err instanceof RelayError) throw err;
    throw new RelayError(0); // network / fetch failure
  }
}

// Clears the frontend-domain cookie. Call alongside removeToken() on logout.
export async function clearFrontendCookie(): Promise<void> {
  await fetch('/api/auth/set-cookie', { method: 'DELETE' });
}

// Full sign-out: clears memory token, backend cookie, and frontend cookie.
export async function signOut(): Promise<void> {
  removeToken();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  await Promise.all([
    fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {}),
    clearFrontendCookie(),
  ]);
}
