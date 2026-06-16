"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api/client";
import UserAvatar from "@/app/components/UserAvatar";
import Loader from "@/app/components/Loader";
import { useUser } from "@/app/context/UserContext";

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
  1: { accent: "#EAB308", solidBg: "rgba(234,179,8,0.88)", subtleBg: "rgba(234,179,8,0.12)" },
  2: { accent: "#818CF8", solidBg: "rgba(129,140,248,0.18)", subtleBg: "rgba(129,140,248,0.10)" },
  3: { accent: "#F97316", solidBg: "rgba(249,115,22,0.88)", subtleBg: "rgba(249,115,22,0.12)" },
} as const;

const PODIUM_IDX = [1, 0, 2]; // left = 2nd, centre = 1st, right = 3rd

// ── count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - (1 - t) ** 3) * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return val;
}

// ── sub-components ───────────────────────────────────────────────────────────
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

/** Avatar circle with a coloured ring + rank badge overlaid at bottom-left */
function PodiumAvatar({
  entry,
  size,
  accent,
}: {
  entry: LeaderboardEntry;
  size: number;
  accent: string;
}) {
  const badgeSize = Math.round(size * 0.36);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full overflow-hidden w-full h-full"
        style={{ boxShadow: `0 0 0 3px ${accent}, 0 0 16px ${accent}55` }}
      >
        <UserAvatar
          avatarConfig={entry.avatarConfig}
          avatarUrl={entry.avatarUrl}
          name={entry.name ?? entry.email}
          size={size}
        />
      </div>
      {/* rank badge */}
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

/** A single pill row in the ranked list */
function RankRow({
  entry,
  isYou,
  delay,
}: {
  entry: LeaderboardEntry;
  isYou: boolean;
  delay: number;
}) {
  const top3Cfg = entry.rank <= 3 ? RANK_CFG[entry.rank as 1 | 2 | 3] : null;
  const isSolidRow = entry.rank === 1 || entry.rank === 3;

  const rowBg = top3Cfg
    ? isSolidRow ? top3Cfg.solidBg : top3Cfg.subtleBg
    : isYou
    ? "rgba(99,102,241,0.22)"
    : "rgba(255,255,255,0.05)";

  const accent = top3Cfg?.accent ?? (isYou ? "#818CF8" : "#475569");
  const ringColor = top3Cfg?.accent ?? (isYou ? "#818CF8" : "rgba(255,255,255,0.15)");
  const textColor = isSolidRow ? "#fff" : "#e2e8f0";

  const displayName = isYou
    ? "You"
    : (entry.name ?? entry.email.split("@")[0]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.28, ease: "easeOut" }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
    >
      {/* pill card */}
      <div
        className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl"
        style={{ background: rowBg }}
      >
        {/* rank number */}
        <span
          className="w-6 shrink-0 text-center font-bold text-sm tabular-nums"
          style={{ color: accent }}
        >
          {entry.rank}
        </span>

        {/* avatar with ring */}
        <div
          className="rounded-full overflow-hidden shrink-0"
          style={{
            width: 36,
            height: 36,
            boxShadow: `0 0 0 2px ${ringColor}`,
          }}
        >
          <UserAvatar
            avatarConfig={entry.avatarConfig}
            avatarUrl={entry.avatarUrl}
            name={entry.name ?? entry.email}
            size={36}
          />
        </div>

        <p
          className="flex-1 font-semibold text-sm truncate"
          style={{ color: textColor }}
        >
          {displayName}
        </p>

        <p
          className="font-bold tabular-nums text-sm shrink-0"
          style={{ color: isSolidRow ? "#fff" : accent }}
        >
          {entry.points.toLocaleString()} pts
        </p>
      </div>
    </motion.div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function LeaderboardView({
  type,
  title,
}: {
  type: "UTME" | "POST_UTME";
  title: string;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiClient<LeaderboardEntry[]>(`/api/leaderboard?type=${type}`)
        .then((data) => { if (!cancelled) { setEntries(data); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [type]);

  const top3 = entries.slice(0, 3);
  const podiumEntries = PODIUM_IDX.map((i) => top3[i]).filter(Boolean) as LeaderboardEntry[];

  // Find the current user's entry to pin at the bottom if they're outside the visible list
  const meEntry = user ? entries.find((e) => e.email === user.email) : null;
  const meInList = meEntry != null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">{title}</h1>
        <p className="text-slate-400 text-sm">Top performers ranked by total points earned</p>
      </div>

      {loading ? (
        <Loader className="h-80" />
      ) : entries.length === 0 ? (
        <div className="rounded-3xl p-12 text-center" style={{ background: "#120824" }}>
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-slate-400">No results yet. Complete an exam to appear here!</p>
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden pb-4" style={{ background: "#120824" }}>

          {/* ── Podium ────────────────────────────────────────────────────── */}
          {top3.length > 0 && (
            <div className="px-6 pt-10 pb-8">
              <div className="flex items-center justify-center gap-6">
                {podiumEntries.map((entry, pi) => {
                  const isFirst = entry.rank === 1;
                  const cfg = RANK_CFG[entry.rank as 1 | 2 | 3];
                  const avatarSize = isFirst ? 76 : 58;
                  // 2nd animates first, 3rd next, 1st last (the reveal)
                  const delay = pi === 0 ? 0.1 : pi === 2 ? 0.38 : 0.58;

                  return (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay, type: "spring", stiffness: 180, damping: 16 }}
                      className="flex flex-col items-center gap-3 flex-1 max-w-35"
                    >
                      {/* Crown slot — always reserves height */}
                      <div className="h-14 flex items-end justify-center">
                        {isFirst && <FloatingCrown />}
                      </div>

                      <PodiumAvatar entry={entry} size={avatarSize} accent={cfg.accent} />

                      <div className="text-center">
                        <p className="font-semibold text-white text-sm truncate max-w-30">
                          {user && entry.email === user.email
                            ? "You"
                            : (entry.name ?? entry.email.split("@")[0])}
                        </p>
                        <p
                          className="font-bold tabular-nums text-sm mt-0.5"
                          style={{ color: cfg.accent }}
                        >
                          {isFirst
                            ? <AnimatedPts value={entry.points} />
                            : <>{entry.points.toLocaleString()} pts</>}
                        </p>
                      </div>


                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Ranked list ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5 px-3">
            {entries.map((entry, i) => (
              <RankRow
                key={entry.userId}
                entry={entry}
                isYou={!!(user && entry.email === user.email)}
                delay={0.05 * i + 0.35}
              />
            ))}
          </div>

          {/* ── "You" pinned row — shown only when user is outside the list ── */}
          {user && !meInList && (
            <>
              <div className="mx-6 my-3 border-t border-dashed border-white/10" />
              <div className="px-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: "rgba(99,102,241,0.22)" }}>
                  <span className="w-6 shrink-0 text-center font-bold text-sm text-indigo-400">?</span>
                  <div className="rounded-full overflow-hidden shrink-0"
                    style={{ width: 36, height: 36, boxShadow: "0 0 0 2px #818CF8" }}>
                    <UserAvatar
                      avatarConfig={user.studentProfile?.avatarConfig ?? null}
                      avatarUrl={user.studentProfile?.avatarUrl ?? null}
                      name={user.name}
                      size={36}
                    />
                  </div>
                  <p className="flex-1 font-semibold text-sm text-white">You</p>
                  <p className="font-bold text-sm text-indigo-400">—</p>
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}

function AnimatedPts({ value }: { value: number }) {
  const count = useCountUp(value);
  return <>{count.toLocaleString()} pts</>;
}
