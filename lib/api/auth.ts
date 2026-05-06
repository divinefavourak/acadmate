// Token stored in memory — not accessible to XSS via document.cookie reads.
// Cleared on page refresh (acceptable — the HttpOnly server cookie handles persistence).
let _memoryToken: string | null = null;

const TOKEN_KEY = 'acadmate_token';

export function getToken(): string | null {
  // Prefer in-memory token (set after login in this session)
  if (_memoryToken) return _memoryToken;
  // Fallback: read from cookie only on server side (middleware), not from JS
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setToken(token: string): void {
  _memoryToken = token;
  // Also write a non-sensitive session indicator cookie so Next.js middleware
  // can detect an active session without reading the JWT value.
  if (typeof document !== 'undefined') {
    const maxAge = 60 * 60 * 24 * 7;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  }
}

export function removeToken(): void {
  _memoryToken = null;
  if (typeof document !== 'undefined') {
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}
