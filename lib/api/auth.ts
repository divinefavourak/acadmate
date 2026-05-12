// Token lives in memory only for the current tab session.
// Persistence is handled exclusively by the HttpOnly `acadmate_token` cookie set by the backend.
// The backend JWT strategy accepts both the Authorization header (memory token) and the cookie,
// so auth continues to work after a page refresh even when memory is cleared.
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
