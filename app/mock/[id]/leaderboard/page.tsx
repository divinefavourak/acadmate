"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api/client";

interface LeaderboardEntry {
  rank: number;
  participantId: string;
  name: string;
  score: number | null;
  attemptNumber: number;
}

// Same palette + ordering as the main dashboard leaderboard (LeaderboardView).
const RANK_CFG = {
  1: { accent: "#EAB308", solidBg: "rgba(234,179,8,0.88)", subtleBg: "rgba(234,179,8,0.12)" },
  2: { accent: "#818CF8", solidBg: "rgba(129,140,248,0.18)", subtleBg: "rgba(129,140,248,0.10)" },
  3: { accent: "#F97316", solidBg: "rgba(249,115,22,0.88)", subtleBg: "rgba(249,115,22,0.12)" },
} as const;

const PODIUM_IDX = [1, 0, 2]; // left = 2nd, centre = 1st, right = 3rd

function initial(name: string) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

function fmtScore(score: number | null) {
  return `${(score?.toFixed(1) ?? "0")}%`;
}

function FloatingCrown() {
  return (
    <motion.span
      animate={{ y: [0, -7, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      className="block select-none leading-none"
      style={{ fontSize: 52 }}
    >
      👑
    </motion.span>
  );
}

/** Initials avatar with a coloured ring + rank badge overlaid bottom-left */
function PodiumAvatar({ entry, size, accent }: { entry: LeaderboardEntry; size: number; accent: string }) {
  const badgeSize = Math.round(size * 0.36);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center w-full h-full font-black text-white"
        style={{
          fontSize: size * 0.4,
          background: `radial-gradient(circle, ${accent}66, ${accent}33)`,
          boxShadow: `0 0 0 3px ${accent}, 0 0 16px ${accent}55`,
        }}
      >
        {initial(entry.name)}
      </div>
      <div
        className="absolute -bottom-1 -left-1 rounded-full flex items-center justify-center font-black text-white"
        style={{
          width: badgeSize,
          height: badgeSize,
          fontSize: badgeSize * 0.48,
          background: accent,
          border: "2px solid #120824",
        }}
      >
        {entry.rank}
      </div>
    </div>
  );
}

function RankRow({ entry, delay }: { entry: LeaderboardEntry; delay: number }) {
  const top3Cfg = entry.rank <= 3 ? RANK_CFG[entry.rank as 1 | 2 | 3] : null;
  const isSolidRow = entry.rank === 1 || entry.rank === 3;
  const rowBg = top3Cfg ? (isSolidRow ? top3Cfg.solidBg : top3Cfg.subtleBg) : "rgba(255,255,255,0.05)";
  const accent = top3Cfg?.accent ?? "#475569";
  const ringColor = top3Cfg?.accent ?? "rgba(255,255,255,0.15)";
  const textColor = isSolidRow ? "#fff" : "#e2e8f0";

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.28, ease: "easeOut" }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
    >
      <div className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl" style={{ background: rowBg }}>
        <span className="w-6 shrink-0 text-center font-bold text-sm tabular-nums" style={{ color: accent }}>
          {entry.rank}
        </span>
        <div
          className="rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
          style={{ width: 36, height: 36, background: `${ringColor}55`, boxShadow: `0 0 0 2px ${ringColor}` }}
        >
          {initial(entry.name)}
        </div>
        <p className="flex-1 font-semibold text-sm truncate" style={{ color: textColor }}>
          {entry.name}
        </p>
        <p className="font-bold tabular-nums text-sm shrink-0" style={{ color: isSolidRow ? "#fff" : accent }}>
          {fmtScore(entry.score)}
        </p>
      </div>
    </motion.div>
  );
}

export default function MockLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(() => {
    apiClient<LeaderboardEntry[]>(`/api/mock/${id}/leaderboard`, { skipAuth: true })
      .then((data) => { setEntries(data); setFetchError(false); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const top3 = entries.slice(0, 3);
  const podiumEntries = PODIUM_IDX.map((i) => top3[i]).filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="min-h-screen text-white py-10 px-4" style={{ background: "#0f172a" }}>
      <div className="max-w-2xl mx-auto space-y-6">
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
          <div className="rounded-3xl p-12 text-center" style={{ background: "#120824" }}>
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-slate-400">No results yet. Results will appear here as participants finish.</p>
          </div>
        ) : (
          <div className="rounded-3xl overflow-hidden pb-4" style={{ background: "#120824" }}>
            {/* Podium */}
            {top3.length > 0 && (
              <div className="px-6 pt-10 pb-8">
                <div className="flex items-end justify-center gap-6">
                  {podiumEntries.map((entry, pi) => {
                    const isFirst = entry.rank === 1;
                    const cfg = RANK_CFG[entry.rank as 1 | 2 | 3];
                    const avatarSize = isFirst ? 76 : 58;
                    const delay = pi === 0 ? 0.1 : pi === 2 ? 0.38 : 0.58;
                    return (
                      <motion.div
                        key={entry.participantId}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay, type: "spring", stiffness: 180, damping: 16 }}
                        className="flex flex-col items-center gap-3 flex-1 max-w-35"
                      >
                        <div className="h-14 flex items-end justify-center">
                          {isFirst && <FloatingCrown />}
                        </div>
                        <PodiumAvatar entry={entry} size={avatarSize} accent={cfg.accent} />
                        <div className="text-center">
                          <p className="font-semibold text-white text-sm truncate max-w-30">{entry.name}</p>
                          <p className="font-bold tabular-nums text-sm mt-0.5" style={{ color: cfg.accent }}>
                            {fmtScore(entry.score)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ranked list */}
            <div className="flex flex-col gap-1.5 px-3">
              {entries.map((entry, i) => (
                <RankRow key={entry.participantId} entry={entry} delay={0.05 * i + 0.35} />
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <Link href={`/mock/${id}`} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to exam
          </Link>
        </div>
      </div>
    </div>
  );
}
