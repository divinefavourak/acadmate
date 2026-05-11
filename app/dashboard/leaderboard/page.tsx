"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import UserAvatar from "@/app/components/UserAvatar";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  avatarConfig: Record<string, unknown> | null;
  avatarUrl: string | null;
  points: number;
}

type LeaderboardType = "UTME" | "POST_UTME";

const MEDAL_COLORS = ["#F59E0B", "#94A3B8", "#B45309"] as const;
const MEDAL_LABELS = ["🥇", "🥈", "🥉"] as const;

export default function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>("UTME");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient<LeaderboardEntry[]>(`/api/leaderboard?type=${type}`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [type]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Leaderboard</h1>
        <p className="text-slate-400 text-sm">Top performers ranked by total points earned</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 w-fit text-sm font-medium">
        {(["UTME", "POST_UTME"] as LeaderboardType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-6 py-2.5 transition-colors ${
              type === t
                ? "bg-indigo-600 text-white"
                : "bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            {t === "UTME" ? "JAMB / UTME" : "Post-UTME"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-panel p-8 rounded-2xl animate-pulse h-80" />
      ) : entries.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-slate-400">No results yet for {type === "UTME" ? "JAMB/UTME" : "Post-UTME"}. Complete an exam to appear here!</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div className="glass-panel rounded-2xl p-8 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 to-transparent pointer-events-none" />
              <div className="flex items-end justify-center gap-4 relative z-10">
                {podiumOrder.map((entry) => {
                  const isCenter = entry.rank === 1;
                  const medalIdx = entry.rank - 1;
                  const podiumH = isCenter ? "h-36" : entry.rank === 2 ? "h-28" : "h-20";

                  return (
                    <div key={entry.userId} className="flex flex-col items-center gap-2 flex-1 max-w-[160px]">
                      <div className="text-2xl">{MEDAL_LABELS[medalIdx]}</div>
                      <UserAvatar
                        avatarConfig={entry.avatarConfig}
                        avatarUrl={entry.avatarUrl}
                        name={entry.name ?? entry.email}
                        size={isCenter ? 72 : 56}
                        className="ring-2"
                      />
                      <div className="text-center">
                        <p className={`font-semibold truncate max-w-[130px] ${isCenter ? "text-base" : "text-sm"}`}>
                          {entry.name ?? entry.email.split("@")[0]}
                        </p>
                        <p className={`font-bold tabular-nums ${isCenter ? "text-lg" : "text-base"}`} style={{ color: MEDAL_COLORS[medalIdx] }}>
                          {entry.points.toLocaleString()} pts
                        </p>
                      </div>
                      <div
                        className={`w-full ${podiumH} rounded-t-xl flex items-center justify-center text-2xl font-black opacity-80`}
                        style={{ background: MEDAL_COLORS[medalIdx] + "33", border: `2px solid ${MEDAL_COLORS[medalIdx]}55` }}
                      >
                        <span style={{ color: MEDAL_COLORS[medalIdx] }}>#{entry.rank}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ranked list (4th onwards) */}
          {rest.length > 0 && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-800">
                {rest.map((entry) => (
                  <div key={entry.userId} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/30 transition-colors">
                    <span className="w-8 text-center text-slate-500 font-bold text-sm">#{entry.rank}</span>
                    <UserAvatar
                      avatarConfig={entry.avatarConfig}
                      avatarUrl={entry.avatarUrl}
                      name={entry.name ?? entry.email}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.name ?? entry.email.split("@")[0]}</p>
                    </div>
                    <p className="font-bold tabular-nums text-indigo-400 shrink-0">
                      {entry.points.toLocaleString()} pts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
