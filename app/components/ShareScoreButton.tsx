"use client";

import { useEffect, useRef, useState } from "react";
import { renderScoreCard, shareScoreCard, whatsappShareLink, type ScoreCard } from "@/lib/shareScore";
import { track } from "@/lib/track";

type CardInput = Omit<ScoreCard, "text"> & { text: (url: string) => string };

/**
 * "Share my score". Phones get the share sheet with the score image attached.
 *
 * The image is drawn ahead of time, not on the tap: browsers (Safari above
 * all) only allow the share sheet for a moment after a tap, and fonts, the
 * logo and PNG encoding can take longer than that. If the sheet is closed,
 * has nowhere to share, or files can't be shared at all (most desktops), the
 * WhatsApp message and a download of the image are shown instead.
 */
export default function ShareScoreButton({
  card,
  kind = "result",
  className = "",
}: {
  card: CardInput;
  /** For the funnel: which share button this was. */
  kind?: "daily" | "result";
  className?: string;
}) {
  const [prepared, setPrepared] = useState<{ key: string; full: ScoreCard; image: Blob } | null>(null);
  // Tied to the card it was made from: if the card changes (the streak can
  // load later), the old WhatsApp text and image are no longer offered.
  const [fallback, setFallback] = useState<{ key: string; url: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const cardRef = useRef(card);
  useEffect(() => {
    cardRef.current = card;
  });

  // Redraw only when what's on the card changes (the streak can arrive late).
  // The message is part of the identity: two cards can look the same (50%)
  // but need different text (5/10 vs 10/20).
  const message = typeof window === "undefined" ? "" : card.text(window.location.origin);
  const key = JSON.stringify([card.headline, card.label, card.detail ?? "", card.streak ?? 0, message]);
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  });

  useEffect(() => {
    let live = true;
    // After the page has settled, so drawing doesn't compete with first paint.
    const timer = window.setTimeout(() => {
      const c = cardRef.current;
      const full: ScoreCard = { ...c, text: message };
      renderScoreCard(full, window.location.host)
        .then((image) => {
          if (live) setPrepared({ key, full, image });
        })
        .catch(() => {
          if (live) setError("Couldn’t make the image.");
        });
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [key, message]);

  useEffect(() => () => { if (fallback) URL.revokeObjectURL(fallback.url); }, [fallback]);

  const ready = prepared?.key === key ? prepared : null;

  async function share() {
    if (!ready) return;
    setError("");
    // No await before this call: the share sheet needs the tap to be fresh.
    const outcome = await shareScoreCard(ready.full, ready.image);
    track("share_click", { kind, outcome });
    // The card may have changed while the share sheet was open.
    if (outcome !== "shared" && ready.key === keyRef.current) {
      setFallback({ key: ready.key, url: URL.createObjectURL(ready.image), text: ready.full.text });
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={share}
        disabled={!ready}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-mint-500/40 bg-mint-500/10 px-4 py-2.5 text-sm font-semibold text-mint-700 dark:text-mint-300 hover:bg-mint-500/20 disabled:opacity-60 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
        </svg>
        {ready ? "Share my score" : error ? "Share unavailable" : "Preparing…"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {fallback && fallback.key === key && (
        <div role="status" className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={whatsappShareLink(fallback.text)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#25D366] px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            WhatsApp
          </a>
          <a
            href={fallback.url}
            download="acadmate-score.png"
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-sm font-semibold hover:border-brand-500"
          >
            Download image
          </a>
        </div>
      )}
    </div>
  );
}
