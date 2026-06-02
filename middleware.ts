import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Route policy config ────────────────────────────────────────────────────
//
// Design principles:
//   1. The backend (NestJS guards) is the authoritative source for authorization.
//      This middleware provides only UX routing — it redirects before the page
//      shell loads, preventing a flash of protected content.
//   2. Matching is prefix-based (startsWith) so child routes inherit the policy
//      of their parent without individual entries.
//   3. "public" does NOT mean "no auth cookie is read" — authenticated users
//      visiting authRedirect routes are bounced to their home dashboard.
//
// Extending the policy: add entries here only. No logic changes needed.
const ROUTE_POLICY = {
  // Accessible without a valid JWT. Any sub-path inherits this.
  public: [
    "/",
    "/login",
    "/register",
    "/api/auth",
    "/auth/callback",
    "/forgot-password",
    "/reset-password",
    "/blog",
    "/api/blog",
    "/forum",
    "/api/forum",
    // Student live-session landing — viewable without auth; the Join action
    // itself prompts login when needed.
    "/live",
  ],

  // Public routes where a logged-in user should be redirected to their home.
  // Subset of `public` — all entries here must also appear in `public`.
  authRedirect: ["/", "/login", "/register"],

  // Requires ADMIN role. STUDENT role gets 403; anonymous gets redirected to /login.
  admin: ["/admin", "/api/admin"],
} as const;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function getPayload(token: string): Promise<{ sub?: string; role?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { sub?: string; role?: string };
  } catch {
    return null;
  }
}

function isUnderRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets and Next.js internals bypass all policy checks.
  const isNextInternal =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon");
  if (isNextInternal) return NextResponse.next();

  const isPublic = isUnderRoute(pathname, ROUTE_POLICY.public);
  const rawToken = req.cookies.get("acadmate_token")?.value;

  // ── Public route handling ──────────────────────────────────────────────
  if (isPublic) {
    // Bounce logged-in users away from login/register/landing to their dashboard.
    if (isUnderRoute(pathname, ROUTE_POLICY.authRedirect) && rawToken) {
      const payload = await getPayload(rawToken);
      if (payload?.sub) {
        const dest = payload.role === "ADMIN" ? "/admin" : "/dashboard";
        return NextResponse.redirect(new URL(dest, req.url));
      }
    }
    return NextResponse.next();
  }

  // ── Protected route: require a valid JWT ──────────────────────────────
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

  // ── Admin route: require ADMIN role ───────────────────────────────────
  if (isUnderRoute(pathname, ROUTE_POLICY.admin) && payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|images/).*)",
  ],
};
