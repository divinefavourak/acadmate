import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { buildMetadata, webSiteSchema, organizationSchema } from "@/lib/seo";
import { LAUNCH_AT, launchLabel } from "@/lib/launch";
import { LaunchCountdown } from "./components/LaunchCountdown";

// Pre-launch homepage for acadmate.com.ng (the `live` branch). The new site is
// on beta.acadmate.com.ng until launch day, when Vercel's production branch
// switches to master and this page is replaced by the new landing page.
// Everything else on the live site (past questions, sign-in, the CBT) still works.

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Acadmate: JAMB Past Questions with Answers and CBT Practice",
    titleTemplate: false,
    description:
      "Free JAMB past questions with answers, and CBT practice. The new Acadmate opens soon; " +
      "past questions, sign-in and practice are open as usual.",
    path: "/",
    type: "website",
  }),
  title: { absolute: "Acadmate: JAMB Past Questions with Answers and CBT Practice" },
};

const WHATSAPP_URL = "https://wa.me/2349031843486";

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-clip bg-[#09090b] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationSchema(), webSiteSchema()]) }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/4 h-150 w-150 rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-100 w-100 rounded-full bg-emerald-600/10 blur-[100px]" />
      </div>

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/images/logo.jpg" alt="Acadmate" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight">Acadmate</span>
        </Link>
        <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
          <span className="relative inline-flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
          </span>
          Something new is coming
        </p>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
          The new Acadmate opens soon.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-400 leading-relaxed">
          A new look, thousands of checked JAMB past questions with answers, and a better CBT.
          Opening {launchLabel()}.
        </p>

        <div className="mt-10 w-full">
          <LaunchCountdown target={LAUNCH_AT.toISOString()} />
        </div>

        <div className="mt-12 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/past-questions"
            className="rounded-xl bg-indigo-600 px-7 py-3.5 font-bold text-white transition-colors hover:bg-indigo-500"
          >
            Browse past questions
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-white/15 px-7 py-3.5 font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white"
          >
            Create free account
          </Link>
        </div>
        <p className="mt-5 text-sm text-slate-500">
          Already practising with us? Everything still works.{" "}
          <Link href="/login" className="text-indigo-400 hover:underline">
            Sign in
          </Link>
          {" · "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
            Questions? Chat on WhatsApp
          </a>
        </p>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-slate-500">
        <nav className="mb-2 flex justify-center gap-4" aria-label="Footer">
          <Link href="/past-questions" className="hover:text-slate-300">JAMB past questions</Link>
          <Link href="/blog" className="hover:text-slate-300">Blog</Link>
          <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
          <Link href="/terms" className="hover:text-slate-300">Terms</Link>
        </nav>
        © {new Date().getFullYear()} Acadmate Business Consult.
      </footer>
    </div>
  );
}
