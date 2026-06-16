"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api/client";
import UserAvatar from "@/app/components/UserAvatar";
import Loader from "@/app/components/Loader";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  avatarConfig: Record<string, unknown> | null;
  avatarUrl: string | null;
  points: number;
}

const RANK_CFG = {
  1: { accent: "#EAB308", bg: "rgba(234,179,8,0.11)" },
  2: { accent: "#818CF8", bg: "rgba(129,140,248,0.11)" },
  3: { accent: "#F97316", bg: "rgba(249,115,22,0.11)" },
} as const;

// Podium visual order: left = 2nd, centre = 1st, right = 3rd
const PODIUM_IDX = [1, 0, 2];

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function AnimatedPts({ value }: { value: number }) {
  const count = useCountUp(value);
  return <>{count.toLocaleString()} pts</>;
}

function FloatingCrown() {
  return (
    <motion.span
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      className="block text-3xl leading-none"
    >
      👑
    </motion.span>
  );
}

export default function LeaderboardView({
  type,
  title,
}: {
  type: "UTME" | "POST_UTME";
  title: string;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiClient<LeaderboardEntry[]>(`/api/leaderboard?type=${type}`)
        .then((data) => { if (!cancelled) setEntries(data); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [type]);

  const top3 = entries.slice(0, 3);
  const podiumEntries = PODIUM_IDX.map((i) => top3[i]).filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">{title}</h1>
        <p className="text-slate-400 text-sm">Top performers ranked by total points earned</p>
      </div>

      {loading ? (
        <Loader className="h-80" />
      ) : entries.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "#150A28" }}>
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-slate-400">No results yet. Complete an exam to appear here!</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#150A28" }}>
          {/* ── Podium ── */}
          {top3.length > 0 && (
            <div className="px-8 pt-10 pb-6">
              <div className="flex items-end justify-center gap-4">
                {podiumEntries.map((entry, pi) => {
                  const isFirst = entry.rank === 1;
                  const cfg = RANK_CFG[entry.rank as 1 | 2 | 3];
                  const avatarSize = isFirst ? 72 : 56;
                  const podiumH = isFirst ? 96 : entry.rank === 2 ? 68 : 52;
                  // podium order is [2nd, 1st, 3rd] → pi 0=2nd, 1=1st, 2=3rd; 1st enters last
                  const delay = pi === 0 ? 0.1 : pi === 2 ? 0.38 : 0.56;

                  return (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, y: 48 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay, type: "spring", stiffness: 190, damping: 18 }}
                      className="flex flex-col items-center gap-2 flex-1 max-w-[140px]"
                    >
                      {/* Crown slot — keeps spacing consistent */}
                      <div className="h-10 flex items-end justify-center">
                        {isFirst && <FloatingCrown />}
                      </div>

                      {/* Avatar with coloured ring */}
                      <div
                        className="rounded-full overflow-hidden shrink-0"
                        style={{
                          width: avatarSize,
                          height: avatarSize,
                          boxShadow: `0 0 0 3px ${cfg.accent}`,
                        }}
                      >
                        <UserAvatar
                          avatarConfig={entry.avatarConfig}
                          avatarUrl={entry.avatarUrl}
                          name={entry.name ?? entry.email}
                          size={avatarSize}
                        />
                      </div>

                      {/* Name + animated score */}
                      <div className="text-center mt-1">
                        <p className="font-semibold text-white text-sm truncate max-w-[120px]">
                          {entry.name ?? entry.email.split("@")[0]}
                        </p>
                        <p
                          className="font-bold tabular-nums text-sm mt-0.5"
                          style={{ color: cfg.accent }}
                        >
                          <AnimatedPts value={entry.points} />
                        </p>
                      </div>

                      {/* Podium block */}
                      <div
                        className="w-full rounded-t-xl flex items-center justify-center font-black"
                        style={{
                          height: podiumH,
                          background: cfg.bg,
                          border: `1px solid ${cfg.accent}35`,
                          color: cfg.accent,
                          fontSize: isFirst ? 22 : 16,
                        }}
                      >
                        #{entry.rank}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Ranked list ── */}
          <div className="border-t border-white/[0.06]" />
          <div className="divide-y divide-white/[0.05]">
            {entries.map((entry, i) => {
              const cfg = entry.rank <= 3 ? RANK_CFG[entry.rank as 1 | 2 | 3] : null;
              return (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i + 0.3, duration: 0.28 }}
                  className="flex items-center gap-4 px-6 py-3.5"
                  style={cfg ? { background: cfg.bg } : {}}
                >
                  <span
                    className="w-7 text-center font-bold text-sm tabular-nums shrink-0"
                    style={{ color: cfg?.accent ?? "#64748B" }}
                  >
                    {entry.rank}
                  </span>
                  <UserAvatar
                    avatarConfig={entry.avatarConfig}
                    avatarUrl={entry.avatarUrl}
                    name={entry.name ?? entry.email}
                    size={36}
                  />
                  <p className="flex-1 font-medium text-white text-sm truncate">
                    {entry.name ?? entry.email.split("@")[0]}
                  </p>
                  <p
                    className="font-bold tabular-nums text-sm shrink-0"
                    style={{ color: cfg?.accent ?? "#818CF8" }}
                  >
                    {entry.points.toLocaleString()} pts
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
