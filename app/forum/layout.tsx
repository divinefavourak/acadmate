import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/app/components/BrandMark";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: `Forum | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME} Forum`,
  },
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-navy-950 text-slate-900 dark:text-white relative">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-150 h-150 bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-100 h-100 bg-mint-600/10 rounded-full blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-navy-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="text-lg font-bold tracking-tight">Acadmate</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">Blog</Link>
            <Link href="/forum" className="text-slate-900 dark:text-white">Forum</Link>
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">Sign in</Link>
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

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10 md:py-16">
        {children}
      </main>

      <footer className="relative z-10 border-t border-black/5 dark:border-white/5 py-6 mt-12 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Acadmate. Discuss, learn, and grow together.</p>
      </footer>
    </div>
  );
}
