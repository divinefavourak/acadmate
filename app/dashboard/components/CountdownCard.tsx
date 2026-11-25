"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

const DAY_MS = 86_400_000;

/** Whole days from today (Lagos) to the given Lagos date. */
function daysUntil(date: string) {
  const lagosToday = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${lagosToday}T00:00:00Z`)) / DAY_MS);
}

/**
 * Days to the UTME. The date comes from Admin → Settings; until JAMB announces
 * it (and an admin sets it), the card doesn't show.
 */
export default function CountdownCard({ onHidden }: { onHidden?: () => void }) {
  const [date, setDate] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    apiClient<{ date: string | null }>("/api/settings/utme-date")
      .then((r) => setDate(r.date))
      .catch(() => setDate(null));
  }, []);

  const days = date ? daysUntil(date) : null;
  const hidden = date === null || (days !== null && days < 0);
  useEffect(() => {
    if (hidden) onHidden?.();
  }, [hidden, onHidden]);

  if (date === undefined) return <div className="glass-panel rounded-2xl h-full min-h-32 animate-pulse" aria-hidden="true" />;
  if (hidden || days === null) return null;

  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <section aria-labelledby="countdown-heading" className="glass-panel rounded-2xl p-5 sm:p-6 h-full flex flex-col justify-center">
      <h2 id="countdown-heading" className="text-sm font-semibold text-slate-500 dark:text-slate-400">UTME countdown</h2>
      <p className="mt-1 font-display text-5xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
        {days === 0 ? "Today" : days}
        {days > 0 && <span className="ml-2 text-lg font-semibold text-slate-700 dark:text-slate-300">day{days === 1 ? "" : "s"} to go</span>}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Starts {label}</p>
    </section>
  );
}
