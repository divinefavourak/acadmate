"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

interface SessionResult {
  id: string;
  attemptNumber: number;
  score: number | null;
  status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT";
  startedAt: string;
  submittedAt: string | null;
  durationSeconds: number | null;
  participant: { id: string; name: string | null; phone: string };
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(sec: number | null) {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  TIMED_OUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<SessionResult[]>(`/api/admin/mock/${id}/results`)
      .then(setSessions)
      .catch(() => setError("Failed to load results"))
      .finally(() => setLoading(false));
  }, [id]);

  // Group by participant, pick best score
  const byParticipant = sessions.reduce<Record<string, SessionResult[]>>((acc, s) => {
    const pid = s.participant.id;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(s);
    return acc;
  }, {});

  const leaderboard = Object.values(byParticipant)
    .map((pSessions) => {
      const best = pSessions
        .filter((s) => s.status === "SUBMITTED" && s.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.durationSeconds ?? Infinity) - (b.durationSeconds ?? Infinity))[0];
      return { participant: pSessions[0].participant, best, sessions: pSessions };
    })
    .filter((p) => p.best)
    .sort((a, b) => (b.best!.score ?? 0) - (a.best!.score ?? 0));

  const inProgress = sessions.filter((s) => s.status === "IN_PROGRESS");

  return (
    <div className="space-y-6">
      {inProgress.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          {inProgress.length} session{inProgress.length > 1 ? "s" : ""} currently in progress
        </div>
      )}

      {/* Mini leaderboard */}
      {leaderboard.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-sm">Best Scores</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-800">
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3 text-center">Best Score</th>
                <th className="px-4 py-3 text-center">Time</th>
                <th className="px-4 py-3 text-center">Attempt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaderboard.map(({ participant, best }, i) => (
                <tr key={participant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-400">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{participant.name ?? "—"}</p>
                    <p className="text-xs text-slate-400 font-mono">{participant.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{best!.score?.toFixed(1)}%</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{fmtDuration(best!.durationSeconds)}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{best!.attemptNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All sessions */}
      <div>
        <h3 className="font-semibold mb-3">All Attempts ({sessions.length})</h3>
        {loading ? <Loader className="py-8" /> : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : sessions.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-400 text-sm">No attempts yet.</div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-800">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3 text-center">Attempt</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">Duration</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.participant.name ?? "—"}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.participant.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{s.attemptNumber}</td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                      {s.score !== null ? `${s.score.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">{fmtDuration(s.durationSeconds)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[s.status]}`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmt(s.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
