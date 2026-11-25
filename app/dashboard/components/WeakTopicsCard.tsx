"use client";

import Link from "next/link";
import { PremiumCrown } from "@/app/components/PremiumBadge";
import { track } from "@/lib/track";

export interface WeakTopic {
  topicId: string;
  subjectId: string | null;
  name: string;
  correct: number;
  total: number;
  percentage: number;
}

function drillHref(t: WeakTopic) {
  return t.subjectId
    ? `/exam/new?mode=TOPIC&subjectId=${encodeURIComponent(t.subjectId)}&topicId=${encodeURIComponent(t.topicId)}`
    : "/exam/new";
}

/**
 * Topics where the student is getting under half right (from GET /api/analytics).
 * The full list is Premium: Free accounts receive only the weakest one, plus
 * the total, and see how many more Premium would show.
 */
export default function WeakTopicsCard({
  topics,
  total,
  hasExams,
}: {
  topics: WeakTopic[];
  total: number;
  hasExams: boolean;
}) {
  const hidden = Math.max(0, total - topics.length);
  return (
    <section aria-labelledby="weak-heading" className="glass-panel rounded-2xl p-5 sm:p-6 h-full">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="weak-heading" className="text-lg font-bold">Your weakest topics</h2>
        {total > 0 && <span className="text-xs text-slate-500">{total} found</span>}
      </div>

      {topics.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {hasExams
            ? "Nothing under 50% right now. Keep it up."
            : "Finish a few exams and the topics you find hardest show up here."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {topics.map((t) => (
            <li key={t.topicId} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{t.name}</span>
                  <span className="shrink-0 text-xs font-bold text-red-500">{t.percentage}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(t.percentage, 3)}%` }} />
                </div>
              </div>
              <Link
                href={drillHref(t)}
                className="shrink-0 rounded-lg border border-brand-500/40 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-500/10"
              >
                Drill this
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <Link
          href="/dashboard/upgrade"
          onClick={() => track("upgrade_click", { from: "weak_topics", hidden })}
          className="mt-4 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-400/20"
        >
          <PremiumCrown />
          <span>
            {hidden} more weak topic{hidden === 1 ? "" : "s"}, each with a one-tap drill, on Premium
          </span>
        </Link>
      )}
    </section>
  );
}
