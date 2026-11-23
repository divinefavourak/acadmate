import Link from "next/link";

/** Announcement bar at the top of the landing page. It sits inside the sticky header, so it stays on screen. */
export default function V2Banner() {
  return (
    <div
      role="region"
      aria-label="Announcement"
      className="bg-linear-to-r from-indigo-600 via-fuchsia-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/40"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 md:py-3 flex items-center justify-between sm:justify-center gap-3 sm:gap-4">
        <p className="text-[13px] sm:text-sm md:text-base leading-snug text-left sm:text-center">
          <span className="relative mr-2 inline-flex h-2.5 w-2.5 align-middle" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="font-extrabold uppercase tracking-wide">Acadmate v2 is coming!</span>{" "}
          {/* Phones get the short version: the banner stays pinned, so it has to stay small. */}
          <span className="text-white/90 sm:hidden">3,400+ checked JAMB questions live.</span>
          <span className="text-white/90 hidden sm:inline">
            A fresh new look, and 3,400+ checked JAMB past questions with explanations are already live.
          </span>
        </p>
        <Link
          href="/register"
          className="shrink-0 rounded-full bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-indigo-700 hover:bg-indigo-50 transition-colors"
        >
          Try them free →
        </Link>
      </div>
    </div>
  );
}
