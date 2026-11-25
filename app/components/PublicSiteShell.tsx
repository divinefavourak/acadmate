import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { BrandMark } from "@/app/components/BrandMark";

const NAV = [
  { href: "/", label: "Home", key: "home" },
  { href: "/past-questions", label: "Past questions", key: "past-questions" },
  { href: "/blog", label: "Blog", key: "blog" },
  { href: "/forum", label: "Forum", key: "forum" },
] as const;

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

type NavKey = (typeof NAV)[number]["key"];

const linkClass = (active: boolean) =>
  active
    ? "text-slate-900 dark:text-white"
    : "hover:text-slate-900 dark:hover:text-white transition-colors";

/**
 * Header and footer for public, crawlable pages (no login): past questions,
 * blog, forum, privacy and terms. Server component; the phone menu is a
 * <details> element, so it works without JavaScript.
 */
export function PublicSiteShell({
  active,
  banner,
  children,
}: {
  active?: NavKey;
  /** Announcement bar pinned above the header (inside it, so it stays on screen). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-navy-950 text-slate-900 dark:text-white relative overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute top-0 left-1/4 w-150 h-150 bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-100 h-100 bg-mint-600/10 rounded-full blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-navy-950/80 backdrop-blur-xl">
        {banner}
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <BrandMark size={32} priority />
            <span className="text-lg font-bold tracking-tight">Acadmate</span>
          </Link>

          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400"
            aria-label="Main navigation"
          >
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                className={linkClass(active === item.key)}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/login" className={linkClass(false)}>
              Sign in
            </Link>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              href="/register"
              className="text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              Get started
            </Link>

            <details className="group relative md:hidden">
              <summary
                className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label="Menu"
              >
                <svg className="group-open:hidden" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                <svg className="hidden group-open:block" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
              </summary>
              <nav
                aria-label="Main navigation"
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-2 flex flex-col text-sm font-medium"
              >
                {NAV.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active === item.key ? "page" : undefined}
                    className={`px-3 py-2.5 rounded-lg ${
                      active === item.key
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/login"
                  className="px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Sign in
                </Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-8 md:py-14">
        {children}
      </main>

      <footer className="relative z-10 border-t border-black/5 dark:border-white/5 py-8 mt-12 text-sm text-slate-500">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Footer">
            {[...NAV, ...LEGAL].map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-slate-900 dark:hover:text-white transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs flex items-center gap-2">
            <BrandMark size={18} />
            &copy; {new Date().getFullYear()} Acadmate Business Consult. Past questions, study tips, school news and more.
          </p>
        </div>
      </footer>
    </div>
  );
}
