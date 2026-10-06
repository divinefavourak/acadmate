"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import UserAvatar from "@/app/components/UserAvatar";
import Loader from "@/app/components/Loader";
import LeaderboardYearFilter, { useLeaderboardYears } from "@/app/components/LeaderboardYearFilter";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  avatarConfig: Record<string, unknown> | null;
  avatarUrl: string | null;
  points: number;
}

export default function AdminPostUtmeLeaderboardPage() {
  const { years, selection, setSelection, query, label } = useLeaderboardYears("POST_UTME", "/api/admin/leaderboard");

  // Entries are stored with the year filter they answer, so switching year
  // shows the loader instead of the previous year's ranking.
  const [loaded, setLoaded] = useState<{ query: string; entries: LeaderboardEntry[] } | null>(null);
  const loading = loaded?.query !== query;
  const entries = loading ? [] : loaded.entries;

  useEffect(() => {
    let cancelled = false;
    apiClient<LeaderboardEntry[]>(`/api/admin/leaderboard?type=POST_UTME&limit=100${query}`)
      .then((data) => { if (!cancelled) setLoaded({ query, entries: data }); })
      .catch(() => { if (!cancelled) setLoaded({ query, entries: [] }); });
    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Post-UTME Leaderboard</h1>
        <p className="text-slate-400 text-sm">{entries.length} student{entries.length !== 1 ? "s" : ""} ranked by points earned {label}</p>
      </div>

      <LeaderboardYearFilter years={years} selection={selection} onChange={setSelection} />

      {loading ? (
        <Loader className="h-80" />
      ) : entries.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 p-12 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-slate-400">No results yet for Post-UTME.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 overflow-hidden border border-slate-800">
          <div className="grid grid-cols-[3rem_1fr_auto] gap-4 px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-800">
            <span>#</span>
            <span>Student</span>
            <span className="text-right">Points</span>
          </div>

          <div className="divide-y divide-slate-800/50">
            {entries.map((entry) => {
              const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
              return (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-[3rem_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-800/40 transition-colors ${
                    entry.rank <= 3 ? "bg-amber-950/10" : ""
                  }`}
                >
                  <span className="text-slate-400 font-bold text-sm">
                    {medal ?? `#${entry.rank}`}
                  </span>
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      avatarConfig={entry.avatarConfig}
                      avatarUrl={entry.avatarUrl}
                      name={entry.name ?? entry.email}
                      size={32}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{entry.name ?? "—"}</p>
                      <p className="text-xs text-slate-500 truncate">{entry.email}</p>
                    </div>
                  </div>
                  <span className="font-bold tabular-nums text-indigo-400 text-sm">
                    {entry.points.toLocaleString()} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
