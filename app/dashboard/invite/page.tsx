"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import UserAvatar from "@/app/components/UserAvatar";
import { apiClient } from "@/lib/api/client";
import { useUser } from "@/app/context/UserContext";
import InviteCard from "../components/InviteCard";

// GET /api/referrals/contest
export interface Contest {
  state: "none" | "upcoming" | "live" | "ended";
  start: string | null;
  end: string | null;
  prize: string;
  entries: {
    rank: number;
    name: string;
    avatarConfig: Record<string, unknown> | null;
    avatarUrl: string | null;
    friends: number;
    you: boolean;
  }[];
  you: { rank: number | null; friends: number; disqualified: boolean } | null;
}

function contestDate(day: string | null) {
  if (!day) return "";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "long" });
}

/** "Invite & win": the invite link, the referral contest and its leaderboard. */
export default function InvitePage() {
  const { user } = useUser();
  const [contest, setContest] = useState<Contest | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient<Contest>("/api/referrals/contest").then(setContest).catch(() => setFailed(true));
  }, []);

  const on = contest && contest.state !== "none";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Invite friends{on && contest.prize ? ` and win ${contest.prize}` : ""}</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {on
            ? "Bring the most friends to Acadmate during the contest and you win. Friends count once they’ve signed up with your link and set up their account."
            : "Share your link with friends preparing for JAMB."}
        </p>
      </div>

      <InviteCard premium={user?.plan === "PREMIUM"} showContest={false} />

      {!contest ? (
        failed ? null : <Loader className="py-6" />
      ) : on ? (
        <>
          <section aria-labelledby="contest-heading" className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="contest-heading" className="text-lg font-bold">Referral contest</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  contest.state === "live"
                    ? "bg-mint-500/15 text-mint-700 dark:text-mint-300"
                    : contest.state === "upcoming"
                    ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
                    : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                }`}
              >
                {contest.state === "live" ? "On now" : contest.state === "upcoming" ? "Starting soon" : "Ended"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {contestDate(contest.start)} to {contestDate(contest.end)}
              {contest.prize && <> · Prize: <span className="font-semibold text-slate-900 dark:text-white">{contest.prize}</span></>}
            </p>

            {contest.you?.disqualified ? (
              <p role="status" className="mt-4 rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                Your entry was removed from this contest after a check of the accounts you referred. Message us on
                WhatsApp if you think that’s a mistake.
              </p>
            ) : contest.state !== "upcoming" && (
              <p className="mt-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 px-4 py-3 text-sm">
                {contest.you?.rank
                  ? <>You’re <span className="font-bold">#{contest.you.rank}</span> with <span className="font-bold">{contest.you.friends}</span> friend{contest.you.friends === 1 ? "" : "s"}.</>
                  : "You’re not on the board yet. Share your link to get started."}
              </p>
            )}

            {contest.entries.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {contest.state === "upcoming" ? "The board opens when the contest starts." : "No one has brought a friend yet. Be the first."}
              </p>
            ) : (
              <ol className="mt-4 divide-y divide-slate-200 dark:divide-slate-800" aria-label="Contest leaderboard">
                {contest.entries.map((e) => (
                  <li key={e.rank} className={`flex items-center gap-3 py-2.5 ${e.you ? "rounded-xl bg-brand-500/10 px-2 -mx-2" : ""}`}>
                    <span className={`w-7 text-center text-sm font-bold tabular-nums ${e.rank === 1 ? "text-amber-500" : "text-slate-500"}`}>
                      {e.rank}
                    </span>
                    <UserAvatar avatarConfig={e.avatarConfig} avatarUrl={e.avatarUrl} name={e.name} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {e.name}
                      {e.you && <span className="ml-1.5 text-xs text-brand-600 dark:text-brand-400">(you)</span>}
                    </span>
                    <span className="text-sm tabular-nums">
                      <span className="font-semibold">{e.friends}</span>{" "}
                      <span className="text-slate-500">friend{e.friends === 1 ? "" : "s"}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="rules-heading" className="glass-panel rounded-2xl p-5 sm:p-6 text-sm text-slate-600 dark:text-slate-400">
            <h2 id="rules-heading" className="mb-2 text-base font-bold text-slate-900 dark:text-white">How it works</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>A friend counts when they sign up with your link between {contestDate(contest.start)} and {contestDate(contest.end)}, and finish setting up their account by the end date.</li>
              <li>Ties go to whoever reached the number first.</li>
              <li>We check the top entries before paying. Fake or duplicate accounts remove an entry from the contest.</li>
              <li>We’ll contact the winner on the email or phone number on their account.</li>
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
