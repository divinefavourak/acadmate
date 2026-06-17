// Per-route browser-tab titles for the app's client-rendered pages.
//
// Server-rendered/SEO pages (home, blog, prose marketing, privacy/terms) define
// their own `metadata`, so they are intentionally absent here — RouteTitle leaves
// their server-set <title> untouched when this returns null.
//
// Patterns are tested in order; list the most specific first.
const ROUTES: [RegExp, string][] = [
  // ── Auth & onboarding ──────────────────────────────────────────────
  [/^\/login$/, "Log In"],
  [/^\/register$/, "Create Account"],
  [/^\/forgot-password$/, "Forgot Password"],
  [/^\/reset-password$/, "Reset Password"],
  [/^\/auth\/callback$/, "Signing In…"],
  [/^\/onboarding$/, "Get Started"],

  // ── Dashboard ──────────────────────────────────────────────────────
  [/^\/dashboard\/profile$/, "Profile"],
  [/^\/dashboard\/upgrade$/, "Upgrade"],
  [/^\/dashboard\/leaderboard\/post-utme$/, "Post-UTME Leaderboard"],
  [/^\/dashboard\/leaderboard$/, "Leaderboard"],
  [/^\/dashboard$/, "Dashboard"],

  // ── Exams ──────────────────────────────────────────────────────────
  [/^\/exam\/new$/, "New Exam"],
  [/^\/exam\/post-utme\/schools$/, "Post-UTME Schools"],
  [/^\/exam\/post-utme\/packs$/, "Post-UTME Packs"],
  [/^\/exam\/[^/]+$/, "Exam"],
  [/^\/results\/[^/]+$/, "Result"],
  [/^\/results$/, "Results"],
  [/^\/my-flags$/, "My Flagged Questions"],
  [/^\/analytics$/, "Analytics"],

  // ── Reading & community ────────────────────────────────────────────
  [/^\/prose\/[^/]+$/, "Passage"],
  [/^\/prose$/, "Comprehension Passages"],
  [/^\/forum\/[^/]+$/, "Discussion"],
  [/^\/forum$/, "Forum"],
  [/^\/live\/[^/]+$/, "Live Session"],

  // ── Mock exam (participant) ────────────────────────────────────────
  [/^\/mock\/[^/]+\/register$/, "Register"],
  [/^\/mock\/[^/]+\/login$/, "Log In"],
  [/^\/mock\/[^/]+\/subjects$/, "Choose Subjects"],
  [/^\/mock\/[^/]+\/exam$/, "Mock Exam"],
  [/^\/mock\/[^/]+\/leaderboard$/, "Mock Leaderboard"],
  [/^\/mock\/[^/]+\/result\/[^/]+$/, "Your Result"],
  [/^\/mock\/[^/]+$/, "Mock Exam"],

  // ── Admin ──────────────────────────────────────────────────────────
  [/^\/admin\/mock\/[^/]+\/participants$/, "Mock · Participants"],
  [/^\/admin\/mock\/[^/]+\/questions$/, "Mock · Questions"],
  [/^\/admin\/mock\/[^/]+\/results$/, "Mock · Results"],
  [/^\/admin\/mock\/[^/]+\/panics$/, "Mock · Reports"],
  [/^\/admin\/mock\/[^/]+$/, "Mock · Overview"],
  [/^\/admin\/mock$/, "Mock Exams"],
  [/^\/admin\/blog\/new$/, "New Post"],
  [/^\/admin\/blog\/[^/]+$/, "Edit Post"],
  [/^\/admin\/blog$/, "Blog Admin"],
  [/^\/admin\/live\/[^/]+$/, "Live Session"],
  [/^\/admin\/live$/, "Live Sessions"],
  [/^\/admin\/students$/, "Students"],
  [/^\/admin\/questions$/, "Questions"],
  [/^\/admin\/subjects$/, "Subjects"],
  [/^\/admin\/imports$/, "Imports"],
  [/^\/admin\/prose$/, "Passages"],
  [/^\/admin\/notifications$/, "Notifications"],
  [/^\/admin\/tokens$/, "Access Tokens"],
  [/^\/admin\/settings$/, "Settings"],
  [/^\/admin\/leaderboard\/post-utme$/, "Post-UTME Leaderboard"],
  [/^\/admin\/leaderboard$/, "Leaderboard"],
  [/^\/admin$/, "Admin"],
];

/** Returns the tab title for a pathname, or null to leave the server title. */
export function titleForPath(pathname: string): string | null {
  for (const [re, title] of ROUTES) {
    if (re.test(pathname)) return title;
  }
  return null;
}
