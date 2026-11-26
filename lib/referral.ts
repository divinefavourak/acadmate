// A friend's invite code, from /register?ref=CODE. Kept in the browser so it
// survives the Google sign-in round trip, and sent with onboarding, which
// is when the friend is credited. Expires after 30 days.

const KEY = "acadmate_ref";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CODE = /^[A-Z0-9]{4,16}$/;

export function normaliseCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

export function storeReferral(raw: string | null | undefined): string | null {
  const code = normaliseCode(raw);
  if (!code) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Private mode or storage full: the invite just isn't remembered.
  }
  return code;
}

export function readReferral(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { code?: string; at?: number } | null;
    if (!saved?.code || !saved.at || Date.now() - saved.at > MAX_AGE_MS) return null;
    return normaliseCode(saved.code);
  } catch {
    return null;
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
