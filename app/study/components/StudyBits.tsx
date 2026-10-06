import type { ReactNode } from "react";

/** Thin progress bar. `tone="onPrimary"` is for use on the solid indigo card. */
export function ProgressBar({
  value,
  max,
  label,
  tone = "default",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "default" | "onPrimary";
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`h-2 w-full rounded-full overflow-hidden ${tone === "onPrimary" ? "bg-white/25" : "bg-slate-200 dark:bg-slate-800"}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tone === "onPrimary" ? "bg-white" : "bg-indigo-600 dark:bg-indigo-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PremiumBadge() {
  return (
    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
      Premium
    </span>
  );
}

const svg = (children: ReactNode) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// Matched on words in the subject name, so new subjects get a sensible icon without code changes.
const ICONS: [RegExp, ReactNode][] = [
  [/math/i, svg(<><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8" /><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" /></>)],
  [/english|literature|language|french|yoruba|igbo|hausa/i, svg(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>)],
  [/physics/i, svg(<><circle cx="12" cy="12" r="1.5" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /></>)],
  [/chem/i, svg(<><path d="M9 3h6" /><path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7.5 15h9" /></>)],
  [/bio|agric/i, svg(<><path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-9 0 10-3 16-9 16z" /><path d="M4 20c3-6 7-9 12-11" /></>)],
  [/geo/i, svg(<><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" /></>)],
  [/econ|commerce|account|business/i, svg(<><path d="M3 3v18h18" /><path d="M7 15v3M12 10v8M17 6v12" /></>)],
  [/government|civic|history|law/i, svg(<><path d="M3 21h18" /><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10" /><path d="M2 10l10-7 10 7z" /></>)],
  [/computer|ict|data/i, svg(<><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m13.5 5-3 14" /></>)],
  [/relig|crs|irs|christian|islam/i, svg(<><path d="M12 3v18" /><path d="M5 12h14" /><circle cx="12" cy="12" r="9" /></>)],
];

const DEFAULT_ICON = svg(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>);

export function SubjectIcon({ name }: { name: string }) {
  return <>{ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? DEFAULT_ICON}</>;
}
