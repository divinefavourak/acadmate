"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import { apiClient } from "@/lib/api/client";

// GET /api/admin/funnel?days=N
interface Step { name: string; label: string; users: number; events: number }
interface Report {
  days: number;
  steps: Step[];
  others: { name: string; users: number; events: number }[];
  upgradeSources: { source: string; users: number; events: number }[];
  daily: { day: string; counts: Record<string, number> }[];
}

const PERIODS = [7, 30, 90] as const;

const OTHER_LABELS: Record<string, string> = {
  upgrade_click: "Clicked an upgrade prompt",
  ask_click: "Tapped “Ask on WhatsApp”",
  share_click: "Shared a score",
  referral_signup: "Signed up from a friend’s link",
};

const SOURCE_LABELS: Record<string, string> = {
  exam_picker: "Exam picker paywall",
  dashboard_strip: "Dashboard “You’re on Free” strip",
  weak_topics: "Weak-topics card",
  streak_freeze: "Streak freeze hint",
  unknown: "Other",
};

function pct(part: number, whole: number) {
  if (!whole) return "–";
  return `${Math.round((part / whole) * 100)}%`;
}

function dayLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

export default function FunnelPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    apiClient<Report>(`/api/admin/funnel?days=${days}`)
      .then((r) => live && (setReport(r), setError("")))
      .catch(() => live && setError("Couldn’t load the funnel."));
    return () => {
      live = false;
    };
  }, [days]);

  const max = Math.max(1, ...(report?.steps.map((s) => s.users) ?? [1]));
  const stepNames = report?.steps.map((s) => s.name) ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Funnel</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
            How many students reached each step towards Premium. Each bar counts different students who did that step
            in the period, so it isn’t a strict cohort: someone can get Premium this week after signing up last month.
          </p>
        </div>
        <div role="group" aria-label="Period" className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setDays(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                days === p ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {p} days
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!report ? (
        !error && <Loader className="py-8" />
      ) : (
        <>
          {/* The funnel: one hue, value and step conversion labelled on every bar */}
          <section aria-labelledby="funnel-heading" className="glass-panel rounded-2xl p-5 sm:p-6">
            <h2 id="funnel-heading" className="text-lg font-bold mb-5">Students at each step, last {report.days} days</h2>
            <ol className="space-y-3">
              {report.steps.map((s, i) => {
                const prev = i > 0 ? report.steps[i - 1].users : null;
                const width = (s.users / max) * 100;
                return (
                  <li key={s.name} className="group relative grid grid-cols-[minmax(9rem,13rem)_1fr] items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.label}</span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 flex-1 min-w-0">
                        <div
                          className="h-full rounded-r-[4px] bg-[#1a91f0] transition-[width] duration-300"
                          style={{ width: s.users ? `max(${width}%, 3px)` : 0 }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-sm tabular-nums">
                        <span className="font-semibold text-slate-900 dark:text-white">{s.users.toLocaleString()}</span>
                        {prev !== null && <span className="ml-1.5 text-slate-500 dark:text-slate-400">{pct(s.users, prev)}</span>}
                      </span>
                    </div>
                    {/* Hover details over the bar area, clear of the value labels; the whole row is the hit area */}
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-1/3 -top-9 z-10 hidden group-hover:block rounded-lg bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-xs text-white shadow-lg whitespace-nowrap"
                    >
                      {s.users.toLocaleString()} students · {s.events.toLocaleString()} times
                      {prev !== null && ` · ${pct(s.users, prev)} of the step before`}
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs text-slate-500">
              The percentage is this step’s students as a share of the step above. “Got Premium” counts grants by
              email and redeemed codes.
            </p>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-labelledby="sources-heading" className="glass-panel rounded-2xl p-5 sm:p-6">
              <h2 id="sources-heading" className="text-lg font-bold mb-3">Where upgrade clicks came from</h2>
              {report.upgradeSources.length === 0 ? (
                <p className="text-sm text-slate-500">No upgrade clicks in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th scope="col" className="pb-2 font-medium">Prompt</th>
                      <th scope="col" className="pb-2 font-medium text-right">Students</th>
                      <th scope="col" className="pb-2 font-medium text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.upgradeSources.map((r) => (
                      <tr key={r.source} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="py-2">{SOURCE_LABELS[r.source] ?? r.source}</td>
                        <td className="py-2 text-right tabular-nums">{r.users}</td>
                        <td className="py-2 text-right tabular-nums">{r.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section aria-labelledby="other-heading" className="glass-panel rounded-2xl p-5 sm:p-6">
              <h2 id="other-heading" className="text-lg font-bold mb-3">Other actions</h2>
              {report.others.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing yet in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th scope="col" className="pb-2 font-medium">Action</th>
                      <th scope="col" className="pb-2 font-medium text-right">Students</th>
                      <th scope="col" className="pb-2 font-medium text-right">Times</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.others.map((r) => (
                      <tr key={r.name} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="py-2">{OTHER_LABELS[r.name] ?? r.name}</td>
                        <td className="py-2 text-right tabular-nums">{r.users}</td>
                        <td className="py-2 text-right tabular-nums">{r.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          {/* Table view of the same data, day by day */}
          <section aria-labelledby="daily-heading" className="glass-panel rounded-2xl p-5 sm:p-6 overflow-x-auto">
            <h2 id="daily-heading" className="text-lg font-bold mb-3">Day by day (Lagos time)</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th scope="col" className="pb-2 pr-3 font-medium">Day</th>
                  {report.steps.map((s) => (
                    <th key={s.name} scope="col" className="pb-2 px-2 font-medium text-right">{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.daily.map((d) => (
                  <tr key={d.day} className="border-t border-slate-200 dark:border-slate-800">
                    <th scope="row" className="py-2 pr-3 font-medium whitespace-nowrap">{dayLabel(d.day)}</th>
                    {stepNames.map((n) => (
                      <td key={n} className={`py-2 px-2 text-right tabular-nums ${d.counts[n] ? "" : "text-slate-400"}`}>
                        {d.counts[n] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
