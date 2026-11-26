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
    <div
      className={`relative flex min-h-dvh flex-col overflow-clip bg-[#08111f] bg-[url(/images/launch/bg-stars.svg)] bg-size-[max(100%,1440px)_auto] bg-top text-white`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationSchema(), webSiteSchema()]) }}
      />
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/images/logo.jpg" alt="Acadmate" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight">Acadmate</span>
        </Link>
        <Link href="/login" className="text-sm font-medium text-[#7d93ad] transition-colors hover:text-white">
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pt-10 pb-6 text-center">
        <h1 className="text-sm font-bold uppercase tracking-[0.35em] sm:text-lg">
          V2 launching soon
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[#7d93ad] sm:text-base">
          The new Acadmate opens {launchLabel()}: a new look, thousands of checked JAMB past
          questions with answers, and a better CBT.
        </p>

        <div className="mt-12 w-full sm:mt-16">
          <LaunchCountdown target={LAUNCH_AT.toISOString()} />
        </div>

        <div className="mt-14 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/past-questions"
            className="rounded-lg bg-[#0874d4] px-7 py-3.5 font-bold text-white transition-colors hover:bg-[#085dab]"
          >
            Browse past questions
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-white/15 px-7 py-3.5 font-semibold text-slate-200 transition-colors hover:border-[#4fadf9] hover:text-white"
          >
            Create free account
          </Link>
        </div>
        <p className="mt-5 text-sm text-[#7d93ad]">
          Already practising with us? Everything still works.{" "}
          <Link href="/login" className="text-[#4fadf9] hover:underline">
            Sign in
          </Link>
        </p>
      </main>

      {/* The hills art sits on the footer's top edge, over the starry sky. The front ridge's colour
          only starts lower down (where the art is already solid), and the padding keeps the links
          below the ridge line. The art is 1440x197 and never drawn narrower than 900px. */}
      <footer
        className="relative z-10 text-center text-xs text-[#7d93ad]"
        style={{
          background:
            "url(/images/launch/pattern-hills.svg) top / max(100%, 900px) auto no-repeat, " +
            "linear-gradient(#10243a, #10243a) 0 max(94px, 10.4vw) / 100% 100% no-repeat",
        }}
      >
        <div className="px-4 pb-8 pt-[max(5.5rem,6.5vw)]">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            className="mx-auto mb-5 inline-flex items-center gap-2 text-sm transition-colors hover:text-[#4fadf9]"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-current">
              <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.48-8.41" />
            </svg>
            Questions? Chat on WhatsApp
          </a>
          <nav className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1" aria-label="Footer">
            <Link href="/past-questions" className="hover:text-white">JAMB past questions</Link>
            <Link href="/blog" className="hover:text-white">Blog</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </nav>
          © {new Date().getFullYear()} Acadmate Business Consult.
        </div>
      </footer>
    </div>
  );
}
