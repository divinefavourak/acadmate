// Shared Premium visuals: a gold crown, a "Premium" chip and an avatar ring.
// Gold is kept for Premium only, so it reads as a status everywhere it shows.

/** Gold ring classes for a Premium student's avatar (wrap the avatar in it). */
export const PREMIUM_RING =
  "rounded-full p-[2px] bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-600 shadow-[0_0_12px_rgba(245,158,11,0.35)]";

export function PremiumCrown({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={`text-amber-500 dark:text-amber-400 ${className}`}
    >
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Z" />
      <rect x="5" y="19.5" width="14" height="2" rx="1" />
    </svg>
  );
}

export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-950 shadow-sm ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Z" />
      </svg>
      Premium
    </span>
  );
}
