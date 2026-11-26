"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import ShareScoreButton from "@/app/components/ShareScoreButton";
import { track } from "@/lib/track";

// GET /api/daily
export interface DailyStatus {
  date: string;
  questionCount: number;
  durationMinutes: number;
  state: "NEW" | "IN_PROGRESS" | "DONE";
  sessionId: string | null;
  resultId: string | null;
  correct: number | null;
  total: number | null;
  streak: {
    current: number;
    activeToday: boolean;
    frozenDays: string[];
    freezeUsedThisWeek: boolean;
    freezes: boolean;
  };
}

/** Today in Lagos (UTC+1, no daylight saving), "YYYY-MM-DD". */
function lagosToday() {
  return new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
}

/** Milliseconds until the next Lagos midnight. */
function msToLagosMidnight() {
  const lagosNow = Date.now() + 3_600_000;
  const DAY = 86_400_000;
  return DAY - (lagosNow % DAY);
}

function streakNote(s: DailyStatus["streak"]) {
  if (s.activeToday) return "Done for today. See you tomorrow.";
  if (s.current > 0) return "Finish any exam today to keep it going.";
  return "Finish an exam today to start one.";
}

export default function DailyCard() {
  const router = useRouter();
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  // Hidden only when the API has no /daily (404). Other failures keep what's
  // shown, or offer a retry when there's nothing yet.
  const [unsupported, setUnsupported] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadRef = useRef<() => void>(() => {});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  // Refresh when the Lagos day turns over: at midnight if the tab stays open,
  // and when the student comes back to a tab left open overnight.
  useEffect(() => {
    let live = true;
    let shownDay = "";
    let timer = 0;
    const load = () =>
      apiClient<DailyStatus>("/api/daily")
        .then((d) => {
          if (!live) return;
          // A request sent just before midnight can answer after the one
          // sent at midnight: never step back to yesterday.
          if (shownDay && d.date < shownDay) return;
          shownDay = d.date;
          setDaily(d);
          setLoadError(false);
        })
        .catch((err) => {
          if (!live) return;
          if (err instanceof ApiError && err.status === 404) setUnsupported(true);
          else setLoadError(true);
        });
    loadRef.current = load;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        load();
        schedule();
      }, msToLagosMidnight() + 1_000);
    };
    const onVisible = () => {
      // Also retries when the first load failed (nothing shown yet).
      if (document.visibilityState === "visible" && (!shownDay || shownDay !== lagosToday())) load();
    };
    load();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      live = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // Always ask the server for today's session: it resumes one started today
  // and never hands back yesterday's.
  async function start() {
    setStarting(true);
    setError("");
    try {
      const { sessionId } = await apiClient<{ sessionId: string }>("/api/daily/start", { method: "POST" });
      router.push(`/exam/${sessionId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t start today’s challenge. Try again.");
      setStarting(false);
    }
  }

  // Older API without /daily: show nothing rather than a broken card.
  if (unsupported) return null;
  // Nothing loaded, or only yesterday's challenge (the midnight refresh
  // failed): offer a retry rather than yesterday's answers.
  if (loadError && (!daily || daily.date < lagosToday())) {
    return (
      <div role="status" className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600 dark:text-slate-400">Couldn’t load today’s challenge.</span>
        <button type="button" onClick={() => loadRef.current()} className="btn-secondary px-4 py-2 text-sm">Try again</button>
      </div>
    );
  }
  if (!daily) return <div className="glass-panel rounded-2xl h-40 animate-pulse" aria-hidden="true" />;

  const { streak } = daily;
  const dateLabel = new Date(`${daily.date}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

  return (
    <section aria-labelledby="daily-heading" className="glass-panel rounded-2xl p-5 sm:p-6 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-mint-700 dark:text-mint-400">{dateLabel}</p>
          <h2 id="daily-heading" className="text-lg sm:text-xl font-bold">Daily challenge</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {daily.state === "DONE"
              ? `You got ${daily.correct} of ${daily.total} today.`
              : `${daily.questionCount} questions from your subjects, about ${daily.durationMinutes} minutes. Free questions aren’t used up.`}
          </p>
        </div>

        {daily.state === "DONE" ? (
          <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
            <Link href={`/results/${daily.resultId}`} className="btn-secondary text-center text-sm py-2.5">
              See answers
            </Link>
            <ShareScoreButton
              kind="daily"
              card={{
                headline: `${daily.correct}/${daily.total}`,
                label: "Today’s daily challenge",
                detail: `Acadmate · ${dateLabel}`,
                streak: streak.current,
                text: (url) =>
                  `I got ${daily.correct}/${daily.total} on today's Acadmate daily challenge${streak.current >= 2 ? `, ${streak.current} days in a row 🔥` : ""}. Can you beat it? ${url}`,
              }}
            />
          </div>
        ) : (
          <button type="button" onClick={start} disabled={starting} className="btn-primary text-sm px-6 py-2.5 disabled:opacity-60">
            {starting ? "Starting…" : daily.state === "IN_PROGRESS" ? "Continue today’s challenge" : "Start today’s challenge"}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="flex sm:flex-col items-center gap-4 sm:gap-1 sm:min-w-44 sm:text-center rounded-2xl bg-amber-500/10 border border-amber-500/20 px-5 py-4">
        <span aria-hidden="true" className={`text-4xl leading-none ${streak.current > 0 ? "" : "grayscale opacity-50"}`}>🔥</span>
        <div className="min-w-0">
          <p className="text-2xl font-extrabold tabular-nums">
            {streak.current} <span className="text-base font-semibold">day{streak.current === 1 ? "" : "s"}</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{streakNote(streak)}</p>
          {streak.freezes ? (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              {streak.freezeUsedThisWeek ? "Streak freeze used this week" : "Streak freeze ready this week"}
            </p>
          ) : (
            <Link href="/dashboard/upgrade" onClick={() => track("upgrade_click", { from: "streak_freeze" })} className="mt-1 inline-block text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
              Premium forgives one missed day a week
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
