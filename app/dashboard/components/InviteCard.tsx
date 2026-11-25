"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { track } from "@/lib/track";

// GET /api/users/me/referral
interface Referral {
  code: string;
  path: string;
  signedUp: number;
  joined: number;
  rewarded: number;
  bonusQuestions: number;
  perFriend: number;
  maxFriends: number;
}

/**
 * Invite friends. Free students get bonus questions for each friend who joins
 * and finishes setting up; Premium students just get a link to share.
 */
export default function InviteCard({ premium }: { premium: boolean }) {
  const [ref, setRef] = useState<Referral | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient<Referral>("/api/users/me/referral").then(setRef).catch(() => setFailed(true));
  }, []);

  // Older API without referrals: no card.
  if (failed) return null;
  if (!ref) return <div className="glass-panel rounded-2xl h-32 animate-pulse" aria-hidden="true" />;

  const link = `${window.location.origin}${ref.path}`;
  const message = premium
    ? `I'm preparing for JAMB on Acadmate: real past questions and CBT practice. Join me: ${link}`
    : `I'm preparing for JAMB on Acadmate: real past questions, a daily challenge and CBT practice. Join with my link and help me unlock more questions: ${link}`;
  const capped = ref.rewarded >= ref.maxFriends;

  function copy() {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        track("invite_click", { via: "copy" });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <section aria-labelledby="invite-heading" className="glass-panel rounded-2xl p-5 sm:p-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <h2 id="invite-heading" className="text-lg font-bold">Invite friends</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {premium
            ? "Know someone preparing for JAMB? Send them your link."
            : capped
            ? `You’ve earned the most bonus questions friends can give (${ref.bonusQuestions}). Thank you for spreading the word.`
            : `Every friend who joins with your link and sets up their account gives you ${ref.perFriend} bonus questions to use in any subject.`}
        </p>
        <p className="mt-2 text-sm">
          <span className="font-semibold">{ref.joined}</span>{" "}
          <span className="text-slate-500 dark:text-slate-400">friend{ref.joined === 1 ? "" : "s"} joined</span>
          {!premium && ref.bonusQuestions > 0 && (
            <>
              <span className="text-slate-400"> · </span>
              <span className="font-semibold text-mint-700 dark:text-mint-400">+{ref.bonusQuestions} bonus questions</span>
            </>
          )}
          {ref.signedUp > ref.joined && (
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              ({ref.signedUp - ref.joined} still setting up)
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:w-64">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("invite_click", { via: "whatsapp" })}
          className="rounded-xl bg-[#25D366] px-3 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-semibold hover:border-brand-500"
        >
          <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
        </button>
        <p className="col-span-2 truncate text-center font-mono text-xs text-slate-500" title={link}>
          {link.replace(/^https?:\/\//, "")}
        </p>
      </div>
    </section>
  );
}
