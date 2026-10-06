"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Loader from "@/app/components/Loader";
import { apiClient } from "@/lib/api/client";
import { PremiumBadge, ProgressBar } from "../../components/StudyBits";
import type { MapTopic, SubjectMap } from "../../types";

/** The round marker on the left of each step: tick, lock, or the step number. */
function StepMarker({ topic, step }: { topic: MapTopic; step: number }) {
  const base = "w-11 h-11 shrink-0 rounded-full flex items-center justify-center font-bold text-sm";
  if (topic.state === "done") {
    return (
      <span className={`${base} bg-emerald-500 text-white`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
    );
  }
  if (topic.locked) {
    return (
      <span className={`${base} bg-slate-200 dark:bg-slate-800 text-slate-500`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </span>
    );
  }
  return (
    <span className={`${base} ${topic.recommended ? "bg-indigo-600 text-white" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"}`}>
      {step}
    </span>
  );
}

function statusText(t: MapTopic) {
  if (t.state === "done") return "Completed";
  if (t.locked) return "Premium · preview available";
  const sections = `${t.totalNotes} section${t.totalNotes === 1 ? "" : "s"}`;
  return t.state === "in_progress" ? `${t.readNotes} of ${t.totalNotes} sections read` : sections;
}

export default function StudySubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SubjectMap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient<SubjectMap>(`/api/study/subjects/${id}`)
      .then(setData)
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) {
    return (
      <div className="max-w-xl mx-auto glass-panel p-10 rounded-2xl text-center space-y-4">
        <p className="text-slate-500">We couldn&apos;t find that subject.</p>
        <Link href="/study" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Back to Study</Link>
      </div>
    );
  }
  if (!data) return <Loader className="py-24" />;

  const { subject, topics } = data;
  const done = topics.filter((t) => t.state === "done").length;
  const next = topics.find((t) => t.recommended);

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-24">
      <div className="space-y-4">
        <Link href="/study" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          Study
        </Link>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{subject.name}</h1>
          {subject.description && <p className="text-slate-500 dark:text-slate-400">{subject.description}</p>}
        </div>
        {topics.length > 0 && (
          <div className="space-y-1.5">
            <ProgressBar value={done} max={topics.length} label={`${subject.name} progress`} />
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">{done} of {topics.length} topics completed</p>
          </div>
        )}
      </div>

      {topics.length === 0 ? (
        <p className="glass-panel p-10 rounded-2xl text-center text-slate-500">Notes for this subject are being written. Check back soon.</p>
      ) : (
        <ol>
          {topics.map((t, i) => (
            <li key={t.id}>
              {/* The line joining this step to the one above it. */}
              {i > 0 && (
                <div aria-hidden="true" className={`mx-auto w-0.5 h-6 ${topics[i - 1].state === "done" ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`} />
              )}
              <div className={t.recommended ? "rounded-3xl bg-indigo-500/10 p-3 pt-2" : ""}>
                {t.recommended && (
                  <span className="inline-block mb-2 ml-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-600 text-white">
                    Recommended next
                  </span>
                )}
                <Link
                  href={`/study/topic/${t.id}`}
                  aria-current={t.recommended ? "step" : undefined}
                  className={`flex items-center gap-4 p-4 rounded-2xl border bg-white dark:bg-slate-900/70 hover:-translate-y-0.5 hover:shadow-lg transition-all ${t.recommended ? "border-indigo-500" : "border-slate-200 dark:border-slate-800"}`}
                >
                  <StepMarker topic={t} step={i + 1} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold leading-snug">{t.name}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{statusText(t)}</span>
                  </span>
                  {t.notesAccess === "PREMIUM" && <PremiumBadge />}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}

      {next && (
        <div className="sticky bottom-4">
          <Link
            href={`/study/topic/${next.id}`}
            className="block text-center px-6 py-4 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold shadow-xl hover:opacity-90 transition-opacity"
          >
            {next.state === "in_progress" ? "Continue" : "Start"}: {next.name}
          </Link>
        </div>
      )}
    </div>
  );
}
