import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

// Returns the raw JWT from the frontend-domain HttpOnly cookie so the client
// can restore its in-memory token after a page refresh.
export async function GET(req: NextRequest) {
  const token = req.cookies.get('acadmate_token')?.value;
  if (!token) return NextResponse.json({ error: 'No session' }, { status: 401 });

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }
}
