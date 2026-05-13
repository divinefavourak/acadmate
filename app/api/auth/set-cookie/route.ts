import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'acadmate_token';
const MAX_AGE = 7 * 24 * 60 * 60; // seconds

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

// Called after login / OAuth to mirror the JWT as a cookie on the frontend domain
// so Next.js middleware can read it for route protection.
export async function POST(req: NextRequest) {
  const body = await req.json() as { token?: string };
  const token = body?.token;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  try {
    await jwtVerify(token, getSecret());
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return res;
}

// Called on logout to clear the frontend-domain cookie
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
