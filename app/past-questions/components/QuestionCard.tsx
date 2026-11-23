"use client";

import { createContext, useContext, useId, useState } from "react";
import Link from "next/link";

/** Whether the enclosing card's solution is open, for content that loads on demand. */
const SolutionOpenContext = createContext(false);
export const useSolutionOpen = () => useContext(SolutionOpenContext);

/**
 * Card shell for one past question. The only client-side state is whether
 * the solution is open. It sets data-revealed on the card, and the
 * server-rendered options use group-data-[revealed=true]: to mark the
 * correct one. The solution is always in the HTML (just `hidden`), so search
 * engines index it while students get to try first.
 */
export function QuestionCard({
  chips,
  body,
  solution,
  href,
  sharePath,
  shareTitle,
  defaultOpen = false,
  id,
}: {
  chips: React.ReactNode;
  body: React.ReactNode;
  solution: React.ReactNode;
  /** The question's own page. Omit on that page itself. */
  href?: string;
  sharePath: string;
  shareTitle: string;
  defaultOpen?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <article
      id={id}
      data-revealed={open}
      className="group scroll-mt-24 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#111114] shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-black/5 dark:border-white/10 px-4 py-2.5">
        {chips}
      </div>

      <div className="px-4 pt-4">{body}</div>

      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-indigo-600/50 dark:border-indigo-400/50 px-3.5 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
        >
          {open ? "Hide solution" : "View solution"}
        </button>
        <div className="flex items-center gap-1">
          {href && (
            <Link
              href={href}
              title="Open this question on its own page"
              aria-label="Open this question on its own page"
              className="rounded-md p-2 text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
            </Link>
          )}
          <ShareButton path={sharePath} title={shareTitle} />
        </div>
      </div>

      <div id={panelId} hidden={!open} className="px-4 pb-4">
        <SolutionOpenContext.Provider value={open}>{solution}</SolutionOpenContext.Provider>
      </div>
    </article>
  );
}

function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closing the share sheet rejects; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: leave the button as it was.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      title={copied ? "Link copied" : "Share this question"}
      aria-label={copied ? "Link copied" : "Share this question"}
      className="rounded-md p-2 text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.59 13.51 6.83 3.98" /><path d="m15.41 6.51-6.82 3.98" />
        </svg>
      )}
    </button>
  );
}
