"use client";

import { useEffect, useState } from "react";
import { renderScoreCard, shareScoreCard, whatsappShareLink, type ScoreCard } from "@/lib/shareScore";
import { track } from "@/lib/track";

/**
 * "Share my score". Phones get the share sheet with the score image attached.
 * Where files can't be shared (most desktops), it falls back to a WhatsApp
 * message and a download of the image.
 */
export default function ShareScoreButton({
  card,
  kind = "result",
  className = "",
}: {
  card: Omit<ScoreCard, "text"> & { text: (url: string) => string };
  /** For the funnel: which share button this was. */
  kind?: "daily" | "result";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<{ url: string; text: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => { if (fallback) URL.revokeObjectURL(fallback.url); }, [fallback]);

  async function share() {
    setBusy(true);
    setError("");
    try {
      const origin = window.location.origin;
      const full: ScoreCard = { ...card, text: card.text(origin) };
      const image = await renderScoreCard(full, window.location.host);
      const outcome = await shareScoreCard(full, image);
      track("share_click", { kind, outcome });
      if (outcome === "fallback") setFallback({ url: URL.createObjectURL(image), text: full.text });
    } catch {
      setError("Couldn’t make the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-mint-500/40 bg-mint-500/10 px-4 py-2.5 text-sm font-semibold text-mint-700 dark:text-mint-300 hover:bg-mint-500/20 disabled:opacity-60 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
        </svg>
        {busy ? "Making your image…" : "Share my score"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {fallback && (
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
