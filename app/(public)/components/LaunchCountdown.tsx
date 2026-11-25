"use client";

import { useSyncExternalStore } from "react";

// One shared clock that ticks once a second while anything is subscribed.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
// Whole seconds, so the snapshot only changes once per tick.
const getNow = () => Math.floor(Date.now() / 1000);
// The server can't know the visitor's clock: render placeholders, then the
// real numbers right after hydration. Avoids a hydration mismatch.
const getServerNow = () => null;

const UNITS = [
  { label: "Days", seconds: 86_400 },
  { label: "Hours", seconds: 3_600 },
  { label: "Minutes", seconds: 60 },
  { label: "Seconds", seconds: 1 },
] as const;

/** Days / hours / minutes / seconds until `target` (an ISO string, so it can cross the server/client boundary). */
export function LaunchCountdown({ target }: { target: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  const end = Math.floor(new Date(target).getTime() / 1000);
  const left = now === null ? null : Math.max(0, end - now);

  if (left === 0) {
    return (
      <p className="text-xl font-semibold text-emerald-400" role="status">
        We&apos;re switching over now. Refresh in a minute.
      </p>
    );
  }

  // Each unit is what's left after the bigger units: the remainder modulo the
  // next unit up, divided by this unit's size. Days aren't capped.
  const total = left ?? 0;
  const parts = UNITS.map((u, i) => {
    const within = i === 0 ? total : total % UNITS[i - 1].seconds;
    return { label: u.label, value: Math.floor(within / u.seconds) };
  });

  return (
    // The visible digits change every second, so screen readers get one stable sentence instead.
    <div>
      <p className="sr-only">
        {left === null ? "Countdown to launch" : `${parts[0].value} days and ${parts[1].value} hours to launch`}
      </p>
      <ol aria-hidden className="grid grid-cols-4 gap-2 sm:gap-4 max-w-md mx-auto">
        {parts.map((p) => (
          <li key={p.label} className="rounded-2xl border border-white/10 bg-white/5 px-2 py-4 sm:py-5">
            <span className="block text-3xl sm:text-5xl font-extrabold tabular-nums tracking-tight">
              {left === null ? "--" : String(p.value).padStart(2, "0")}
            </span>
            <span className="mt-1 block text-[11px] sm:text-xs uppercase tracking-widest text-slate-400">{p.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
