"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

type LiveStatus = "SCHEDULED" | "ACTIVE" | "ENDED";
type ExamMode = "MOCK" | "PRACTICE" | "TOPIC" | "POST_UTME";

interface Subject {
  id: string;
  name: string;
  code: string;
  _count: { questions: number };
}

interface LiveSession {
  id: string;
  code: string;
  title: string | null;
  status: LiveStatus;
  mode: ExamMode;
  durationMinutes: number;
  questionCount: number;
  createdAt: string;
  endsAt: string | null;
  joinedCount: number;
  submittedCount: number;
}

const MODE_LABELS: Record<ExamMode, string> = {
  MOCK: "Mock Exam",
  PRACTICE: "Practice",
  TOPIC: "Topic Drill",
  POST_UTME: "Post-UTME",
};

const STATUS_STYLES: Record<LiveStatus, string> = {
  SCHEDULED:
    "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  ACTIVE:
    "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  ENDED:
    "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminLivePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form state
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<ExamMode>("MOCK");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questionCount, setQuestionCount] = useState(40);
  const [creating, setCreating] = useState(false);

  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiClient<{ subjects: Subject[] }>("/api/subjects"),
      apiClient<{ sessions: LiveSession[] }>("/api/live-sessions"),
    ])
      .then(([sRes, lRes]) => {
        if (sRes.status === "fulfilled") setSubjects(sRes.value.subjects ?? []);
        if (lRes.status === "fulfilled") setSessions(lRes.value.sessions ?? []);
        else setError("Failed to load live sessions.");
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const data = await apiClient<{ session: LiveSession }>("/api/live-sessions", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || undefined,
          mode,
          subjectIds: selectedSubjects,
          durationMinutes,
          questionCount,
        }),
      });
      // The list endpoint enriches with counts the create response lacks.
      setSessions((prev) => [
        { ...data.session, joinedCount: 0, submittedCount: 0 },
        ...prev,
      ]);
      setTitle("");
      setSelectedSubjects([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create session.");
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(code: string, status: LiveStatus) {
    setBusyCode(code);
    setError("");
    try {
      await apiClient(`/api/live-sessions/${code}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSessions((prev) =>
        prev.map((s) => (s.code === code ? { ...s, status } : s)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update session.");
    } finally {
      setBusyCode(null);
    }
  }

  function copyJoinLink(code: string) {
    const url = `${window.location.origin}/live/${code}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => setError("Couldn't copy the link — copy it manually instead."));
  }

  const activeSubjects = useMemo(
    () => subjects.filter((s) => s._count.questions > 0),
    [subjects],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Live Sessions</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Create a timed mock practice, share the code with your class, and watch results land in real time.
        </p>
      </div>

      {/* Create panel */}
      <div className="glass-panel p-6 rounded-2xl space-y-5">
        <h2 className="font-semibold text-lg">New Live Session</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ls-title" className="text-sm font-medium">
              Title <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="ls-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SS3 Friday Mock"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ls-mode" className="text-sm font-medium">
              Exam type
            </label>
            <select
              id="ls-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as ExamMode)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {(Object.keys(MODE_LABELS) as ExamMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Subjects{" "}
              <span className="text-slate-400 font-normal">
                ({selectedSubjects.length || "all"} selected)
              </span>
            </label>
            <span className="text-xs text-slate-400">
              Leave empty to draw from the whole question bank
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeSubjects.map((s) => {
              const on = selectedSubjects.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSubject(s.id)}
                  aria-pressed={on}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    on
                      ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration + count sliders */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ls-duration" className="text-sm font-medium">
              Duration
            </label>
            <div className="flex items-center gap-4">
              <input
                id="ls-duration"
                type="range"
                min={5}
                max={180}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer"
              />
              <span className="w-20 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                {durationMinutes} min
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="ls-count" className="text-sm font-medium">
              Questions
            </label>
            <div className="flex items-center gap-4">
              <input
                id="ls-count"
                type="range"
                min={5}
                max={100}
                step={5}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer"
              />
              <span className="w-12 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                {questionCount}
              </span>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creating ? (
            "Creating…"
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Create Session
            </>
          )}
        </button>
      </div>

      {/* Sessions list */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Your Sessions</h2>
        {loading ? (
          <Loader className="py-8" />
        ) : sessions.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center text-slate-400 text-sm">
            No live sessions yet. Create one above to get started.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                busy={busyCode === s.code}
                copied={copied === s.code}
                onCopy={() => copyJoinLink(s.code)}
                onActivate={() => changeStatus(s.code, "ACTIVE")}
                onEnd={() => changeStatus(s.code, "ENDED")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({
  session: s,
  busy,
  copied,
  onCopy,
  onActivate,
  onEnd,
}: {
  session: LiveSession;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onActivate: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{s.title || "Untitled session"}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {MODE_LABELS[s.mode]} · {s.questionCount} Qs · {s.durationMinutes} min
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${STATUS_STYLES[s.status]}`}
        >
          {s.status === "ACTIVE" && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          {s.status === "SCHEDULED" ? "Scheduled" : s.status === "ACTIVE" ? "Live" : "Ended"}
        </span>
      </div>

      {/* Join code */}
      <button
        onClick={onCopy}
        title="Copy join link"
        className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 hover:border-indigo-400 transition-colors cursor-pointer group"
      >
        <span className="font-mono text-2xl font-bold tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
          {s.code}
        </span>
        <span className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">
          {copied ? "Link copied!" : "Copy link"}
        </span>
      </button>

      {/* Counts */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{s.joinedCount}</span> joined
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{s.submittedCount}</span> submitted
        </span>
        <span className="ml-auto text-xs text-slate-400">{formatDate(s.createdAt)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href={`/admin/live/${s.code}`}
          className="flex-1 text-center px-3 py-2 rounded-xl text-sm font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
        >
          Open dashboard
        </Link>
        {s.status === "SCHEDULED" && (
          <button
            onClick={onActivate}
            disabled={busy}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/15 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {busy ? "…" : "Go live"}
          </button>
        )}
        {s.status === "ACTIVE" && (
          <button
            onClick={onEnd}
            disabled={busy}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/10 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {busy ? "…" : "End"}
          </button>
        )}
      </div>
    </div>
  );
}
