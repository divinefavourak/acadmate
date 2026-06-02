"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

type LiveStatus = "SCHEDULED" | "ACTIVE" | "ENDED";
type ExamStatus = "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "ABANDONED";

interface Participant {
  examSessionId: string;
  user: { id: string; name: string | null; image: string | null };
  status: ExamStatus;
  totalQuestions: number;
  answered: number;
  score: number | null;
  correct: number | null;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string | null;
}

interface ResultsResponse {
  session: {
    id: string;
    code: string;
    title: string | null;
    status: LiveStatus;
    mode: string;
    durationMinutes: number;
    questionCount: number;
    subjects: { id: string; name: string }[];
    endsAt: string | null;
    createdAt: string;
  };
  stats: {
    joined: number;
    inProgress: number;
    submitted: number;
    averageScore: number | null;
  };
  participants: Participant[];
}

const POLL_INTERVAL_MS = 10_000;

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function timeLeftLabel(expiresAt: string | null) {
  if (!expiresAt) return "Not started";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Time up";
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")} left`;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function LiveDashboardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const [data, setData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  // Drives the "updated Ns ago" label without refetching.
  const [, forceTick] = useState(0);

  const fetchResults = useCallback(async () => {
    try {
      const res = await apiClient<ResultsResponse>(
        `/api/live-sessions/${code}/results`,
      );
      setData(res);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load results.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Initial load.
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Poll every 10s, but pause while the tab is hidden to avoid wasted requests.
  const fetchRef = useRef(fetchResults);
  fetchRef.current = fetchResults;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => fetchRef.current(), POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        fetchRef.current();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Re-render every second so timers and "updated Ns ago" stay fresh.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function changeStatus(status: LiveStatus) {
    setBusy(true);
    try {
      await apiClient(`/api/live-sessions/${code}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await fetchResults();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update session.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader className="py-20" />;

  if (error && !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="glass-panel rounded-2xl p-10 text-center text-red-500">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const { session, stats, participants } = data;

  // Submitted first (ranked by score desc), then everyone still working.
  const submitted = participants
    .filter((p) => p.status !== "IN_PROGRESS")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const inProgress = participants.filter((p) => p.status === "IN_PROGRESS");

  const secondsAgo = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    : 0;

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {session.title || "Live Session"}
            </h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Code <span className="font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400">{session.code}</span>
            {" · "}{session.questionCount} questions · {session.durationMinutes} min
            {session.subjects.length > 0 && (
              <> · {session.subjects.map((s) => s.name).join(", ")}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {session.status === "SCHEDULED" && (
            <button
              onClick={() => changeStatus("ACTIVE")}
              disabled={busy}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {busy ? "…" : "Go live"}
            </button>
          )}
          {session.status === "ACTIVE" && (
            <button
              onClick={() => changeStatus("ENDED")}
              disabled={busy}
              className="px-4 py-2 rounded-full text-sm font-semibold text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/10 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {busy ? "…" : "End session"}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Joined" value={stats.joined} accent="indigo" />
        <StatCard label="In progress" value={stats.inProgress} accent="amber" />
        <StatCard label="Submitted" value={stats.submitted} accent="emerald" />
        <StatCard
          label="Average score"
          value={stats.averageScore !== null ? `${stats.averageScore}%` : "—"}
          accent="violet"
        />
      </div>

      {/* Updated indicator */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Leaderboard</h2>
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
          </span>
          Updated {secondsAgo}s ago
        </span>
      </div>

      {participants.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center text-slate-400 text-sm">
          {session.status === "SCHEDULED"
            ? "Session is not live yet. Once you go live and share the code, students will appear here."
            : "Waiting for students to join…"}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Submitted leaderboard */}
          {submitted.length > 0 && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Submitted ({submitted.length})
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {submitted.map((p, i) => (
                  <li
                    key={p.examSessionId}
                    className="flex items-center gap-4 px-5 py-3"
                  >
                    <span
                      className={`w-7 text-center font-bold text-sm ${
                        i === 0
                          ? "text-amber-500"
                          : i === 1
                            ? "text-slate-400"
                            : i === 2
                              ? "text-amber-700"
                              : "text-slate-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <Avatar user={p.user} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {p.user.name || "Anonymous"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.correct ?? 0}/{p.totalQuestions} correct
                        {p.status === "TIMED_OUT" && " · timed out"}
                      </p>
                    </div>
                    <span
                      className={`text-lg font-bold tabular-nums ${scoreColor(p.score ?? 0)}`}
                    >
                      {Math.round(p.score ?? 0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* In-progress */}
          {inProgress.length > 0 && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Still working ({inProgress.length})
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {inProgress.map((p) => {
                  const pct = p.totalQuestions
                    ? Math.round((p.answered / p.totalQuestions) * 100)
                    : 0;
                  return (
                    <li
                      key={p.examSessionId}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      <Avatar user={p.user} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="font-medium text-sm truncate">
                            {p.user.name || "Anonymous"}
                          </p>
                          <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                            {p.answered}/{p.totalQuestions} · {timeLeftLabel(p.expiresAt)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/live"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-500 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      All live sessions
    </Link>
  );
}

function StatusBadge({ status }: { status: LiveStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
        status === "SCHEDULED"
          ? "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50"
      }`}
    >
      {status === "SCHEDULED" ? "Scheduled" : "Ended"}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "indigo" | "amber" | "emerald" | "violet";
}) {
  const accents: Record<string, string> = {
    indigo: "text-indigo-600 dark:text-indigo-400",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${accents[accent]}`}>{value}</p>
    </div>
  );
}

function Avatar({ user }: { user: { name: string | null; image: string | null } }) {
  if (user.image) {
    return (
      // Avatars come from arbitrary external providers (e.g. Google); next/image
      // would require whitelisting every host, so a plain img is the pragmatic fit.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={user.name || "Student"}
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <span className="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
      {initials(user.name)}
    </span>
  );
}
