import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/", "/login", "/register", "/api/auth", "/auth/callback", "/forgot-password", "/reset-password"];
// Authenticated users visiting these routes are redirected to /dashboard
const authRedirectRoutes = ["/", "/login", "/register"];
const adminRoutes = ["/admin", "/api/admin"];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function getPayload(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { sub?: string; role?: string };
  } catch {
    return null;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    publicRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  const rawToken = req.cookies.get("acadmate_token")?.value;

  // Redirect already-authenticated users away from the landing page and auth pages
  if (isPublic) {
    const isAuthRedirectRoute = authRedirectRoutes.some((r) => pathname === r);
    if (isAuthRedirectRoute && rawToken) {
      const payload = await getPayload(rawToken);
      if (payload?.sub) {
        const dest = payload.role === "ADMIN" ? "/admin" : "/dashboard";
        return NextResponse.redirect(new URL(dest, req.url));
      }
    }
    return NextResponse.next();
  }

  if (!rawToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await getPayload(rawToken);
  if (!payload?.sub) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAdmin = adminRoutes.some((r) => pathname.startsWith(r));
  if (isAdmin && payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|images/).*)"],
};
