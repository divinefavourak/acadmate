import Link from "next/link";

/**
 * Announcement bar at the top of the landing page. It sits inside the sticky header, so it stays on screen.
 * `count` is a rounded question count ("3,000"); without it the banner leaves the number out.
 */
export default function V2Banner({ count }: { count?: string }) {
  const over = count ? `over ${count} ` : "";
  return (
    <div
      role="region"
      aria-label="Announcement"
      className="bg-linear-to-r from-brand-600 via-mint-600 to-brand-600 text-white shadow-lg shadow-brand-900/40"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 md:py-3 flex items-center justify-between sm:justify-center gap-3 sm:gap-4">
        <p className="text-[13px] sm:text-sm md:text-base leading-snug text-left sm:text-center">
          <span className="relative mr-2 inline-flex h-2.5 w-2.5 align-middle" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="font-extrabold uppercase tracking-wide">Acadmate v2 is coming!</span>{" "}
          {/* Phones get the short version: the banner stays pinned, so it has to stay small. */}
          <span className="text-white/90 sm:hidden">{count ? `Over ${count}` : "Checked"} JAMB questions live.</span>
          <span className="text-white/90 hidden sm:inline">
            A fresh new look, and {over}checked JAMB past questions with answers are already live.
          </span>
        </p>
        <Link
          href="/register"
          className="shrink-0 rounded-full bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-brand-700 hover:bg-brand-50 transition-colors"
        >
          Try them free →
        </Link>
      </div>
    </div>
  );
}
