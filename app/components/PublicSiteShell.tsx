import Link from "next/link";
import { BrandMark } from "@/app/components/BrandMark";
import { ThemeToggle } from "@/app/components/ThemeToggle";

const NAV = [
  { href: "/", label: "Home", key: "home" },
  { href: "/past-questions", label: "Past questions", key: "past-questions" },
  { href: "/blog", label: "Blog", key: "blog" },
  { href: "/forum", label: "Forum", key: "forum" },
] as const;

type NavKey = (typeof NAV)[number]["key"];

/** Header and footer for public, crawlable pages (no login). */
export function PublicSiteShell({
  active,
  children,
}: {
  active?: NavKey;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-navy-950 text-slate-900 dark:text-white relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute top-0 left-1/4 w-150 h-150 bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-100 h-100 bg-mint-600/10 rounded-full blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-navy-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <BrandMark size={32} />
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
                className={
                  active === item.key
                    ? "text-slate-900 dark:text-white"
                    : "hover:text-slate-900 dark:hover:text-white transition-colors"
                }
              >
                {item.label}
              </Link>
            ))}
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Sign in
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/register"
              className="text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-8 md:py-14">
        {children}
      </main>

      <footer className="relative z-10 border-t border-black/5 dark:border-white/5 py-8 mt-12 text-sm text-slate-500">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Footer">
            {NAV.map((item) => (
              <Link key={item.key} href={item.href} className="hover:text-slate-900 dark:hover:text-white transition-colors">
                {item.label}
              </Link>
            ))}
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link>
          </nav>
          <p className="text-xs">&copy; {new Date().getFullYear()} Acadmate. Past questions, study tips, school news and more.</p>
        </div>
      </footer>
    </div>
  );
}
