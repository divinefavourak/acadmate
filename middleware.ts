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
    // Legal pages must be reachable without auth — Google API verification
    // (and most app-store / OAuth reviews) require the privacy policy URL to
    // load without a login wall. These live in the (public) route group, but
    // that folder name is a Next.js routing convention only; this middleware
    // gate is independent and must list them explicitly.
    "/privacy",
    "/terms",
    "/forum",
    "/api/forum",
    // Public JAMB past-question pages (SEO): hub, subject and year pages, and
    // one page per question. The CBT itself stays behind login.
    "/past-questions",
    "/question",
    // Student live-session landing — viewable without auth; the Join action
    // itself prompts login when needed.
    "/live",
    // Mock exam participant flow — landing, register, login, exam, result,
    // leaderboard. Participants authenticate with a separate localStorage token
    // (not the acadmate_token cookie), so these must never hit the cookie gate.
    "/mock",
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

/**
 * True on the pre-launch beta site (beta.acadmate.com.ng). It runs the same
 * code as the live site, so it is kept out of search results: otherwise Google
 * would see two copies of every past-question page.
 */
function isBetaHost(req: NextRequest): boolean {
  return (req.headers.get("host") ?? "").toLowerCase().startsWith("beta.");
}

export default async function middleware(req: NextRequest) {
  const res = await gate(req);
  // A header rather than robots.txt: a crawler blocked by robots.txt never
  // sees noindex, and can still list the bare URLs.
  if (isBetaHost(req)) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

async function gate(req: NextRequest): Promise<NextResponse> {
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
  // The callback keeps the query string, so a handoff like
  // /exam/new?mode=PRACTICE&subjectId=… survives the trip through login.
  if (!rawToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await getPayload(rawToken);
  if (!payload?.sub) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // ── Admin route: require ADMIN role ───────────────────────────────────
  if (isUnderRoute(pathname, ROUTE_POLICY.admin) && payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  // Static files skip the gate entirely: anything under public/, the app/ icon
  // files, robots.txt and the sitemaps. Matching on the extension means a new
  // public folder can't be locked behind /login by accident (brand/, logos/ and
  // theme-init.js all were). Page and API routes never end in these extensions.
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|js|css|json|txt|xml|woff2?|pdf)$).*)",
  ],
};
