"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MathText from "@/app/components/MathText";
import { ApiError, apiClient } from "@/lib/api/client";
import { ensureToken } from "@/lib/api/auth";
import { useSolutionOpen } from "./QuestionCard";

type State =
  | { kind: "idle" }
  | { kind: "loaded"; text: string | null }
  | { kind: "signed-out" }
  | { kind: "error" };

/**
 * Worked explanation, for signed-in students only. Explanations are never in
 * the cached public HTML: this fetches one from the signed-in API the first
 * time its card's solution opens. Visitors who aren't signed in get a sign-in
 * prompt that brings them back to this question.
 */
export function ExplanationGate({ slug, anchor }: { slug: string; anchor?: string }) {
  const open = useSolutionOpen();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!open || state.kind !== "idle") return;
    let cancelled = false;
    void (async () => {
      const next = await loadExplanation(slug);
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, state.kind, slug]);

  if (state.kind === "idle") {
    return open ? (
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400" role="status">
        Loading the explanation…
      </p>
    ) : null;
  }

  if (state.kind === "signed-out") {
    const back = `${pathname}${anchor ? `#${anchor}` : ""}`;
    return (
      <div className="mt-3 rounded-md border border-indigo-500/20 bg-white/70 dark:bg-white/5 p-3">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Sign in to see the worked explanation. It&apos;s free.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(back)}`}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Create a free account
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        Couldn&apos;t load the explanation.{" "}
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline"
        >
          Try again
        </button>
      </p>
    );
  }

  if (!state.text) return null;
  return (
    <div className="mt-3 leading-relaxed text-slate-700 dark:text-slate-300">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Explanation
      </p>
      <MathText text={state.text} />
    </div>
  );
}

async function loadExplanation(slug: string): Promise<State> {
  const token = await ensureToken();
  if (!token) return { kind: "signed-out" };
  try {
    const res = await apiClient<{ explanation: string | null }>(
      `/api/past-questions/questions/${encodeURIComponent(slug)}/explanation`,
      { on401: "throw" },
    );
    return { kind: "loaded", text: res.explanation };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { kind: "signed-out" };
    return { kind: "error" };
  }
}
