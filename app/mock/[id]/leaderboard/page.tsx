"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";

interface LeaderboardEntry {
  rank: number;
  participantId: string;
  name: string;
  score: number | null;
  correct: number | null;
  total: number | null;
  timeTakenSeconds: number | null;
  attemptNumber: number;
}

function fmtTime(sec: number | null) {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

const RANK_COLORS = ["#EAB308", "#818CF8", "#F97316"];
const RANK_LABELS = ["1st", "2nd", "3rd"];
const PODIUM_ORDER = [1, 0, 2]; // left=2nd, center=1st, right=3rd

export default function MockLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(() => {
    apiClient<LeaderboardEntry[]>(`/api/mock/${id}/leaderboard`, { skipAuth: true })
      .then((data) => {
        setEntries(data);
        setFetchError(false);
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div
      className="min-h-screen text-white py-10 px-4"
      style={{ background: "#120824" }}
    >
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🏆</div>
          <h1 className="text-3xl font-black">Mock Exam Leaderboard</h1>
          <p className="text-slate-400 text-sm">Rankings update live · Best score counts</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-16 text-red-400 text-sm">
            Failed to load leaderboard. It will retry automatically.
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No results yet. Results will appear here as participants complete the exam.
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-4 pt-6">
                {PODIUM_ORDER.filter((pi) => top3[pi]).map((pi) => {
                  const entry = top3[pi];
                  const isFirst = pi === 0;
                  const color = RANK_COLORS[pi];
                  const initial = (entry.name ?? "?").charAt(0).toUpperCase();

                  return (
                    <div key={entry.participantId} className="flex flex-col items-center gap-2 flex-1 max-w-35">
                      {isFirst && (
                        <div className="text-3xl" style={{ animation: "float 3s ease-in-out infinite" }}>👑</div>
                      )}
                      {/* Avatar */}
                      <div
                        className="rounded-full flex items-center justify-center font-black text-white shadow-lg"
                        style={{
                          width: isFirst ? 72 : 56,
                          height: isFirst ? 72 : 56,
                          fontSize: isFirst ? 28 : 22,
                          background: `radial-gradient(circle, ${color}80, ${color}40)`,
                          boxShadow: `0 0 20px ${color}66`,
                          border: `3px solid ${color}`,
                        }}
                      >
                        {initial}
                      </div>
                      <div className="text-center">
                        <p className={`font-bold truncate max-w-30 ${isFirst ? "text-base" : "text-sm"}`}>
                          {entry.name}
                        </p>
                        <p className={`font-black tabular-nums ${isFirst ? "text-2xl" : "text-lg"}`} style={{ color }}>
                          {(entry.score?.toFixed(1) ?? "0")}%
                        </p>
                        <p className="text-xs text-slate-500">{fmtTime(entry.timeTakenSeconds)}</p>
                      </div>
                      <div
                        className={`w-full rounded-t-xl flex items-center justify-center font-black text-xl ${isFirst ? "h-28" : pi === 1 ? "h-20" : "h-14"}`}
                        style={{ background: `${color}22`, border: `2px solid ${color}55` }}
                      >
                        <span style={{ color }}>{RANK_LABELS[pi]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ranked list */}
            {rest.length > 0 && (
              <div className="space-y-2">
                {rest.map((entry) => (
                  <div
                    key={entry.participantId}
                    className="flex items-center gap-4 rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span className="w-8 text-center text-slate-500 font-bold">#{entry.rank}</span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ background: "rgba(99,102,241,0.25)", color: "#a5b4fc" }}
                    >
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{entry.name}</p>
                      <p className="text-xs text-slate-500">{fmtTime(entry.timeTakenSeconds)}</p>
                    </div>
                    <span className="font-black tabular-nums text-indigo-300 shrink-0">
                      {(entry.score?.toFixed(1) ?? "0")}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <Link href={`/mock/${id}`} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to exam
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
      `}</style>
    </div>
  );
}
