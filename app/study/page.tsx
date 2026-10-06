"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Loader from "@/app/components/Loader";
import { apiClient } from "@/lib/api/client";
import { PremiumBadge, ProgressBar, SubjectIcon } from "./components/StudyBits";
import type { ContinueTopic, SearchTopic, StudySubject } from "./types";

export default function StudyHomePage() {
  const [subjects, setSubjects] = useState<StudySubject[] | null>(null);
  const [resume, setResume] = useState<ContinueTopic | null>(null);
  const [failed, setFailed] = useState(false);

  const [query, setQuery] = useState("");
  // Results are stored with the query they answer so a slow response can't show under a newer query.
  const [found, setFound] = useState<{ query: string; topics: SearchTopic[] } | null>(null);
  const term = query.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    apiClient<{ subjects: StudySubject[] }>("/api/study/subjects")
      .then((data) => setSubjects(data.subjects))
      .catch(() => { setSubjects([]); setFailed(true); });
    apiClient<{ topic: ContinueTopic | null }>("/api/study/continue")
      .then((data) => setResume(data.topic))
      .catch(() => { /* the card is optional */ });
  }, []);

  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(() => {
      apiClient<{ topics: SearchTopic[] }>(`/api/study/search?q=${encodeURIComponent(term)}`)
        .then((data) => setFound({ query: term, topics: data.topics }))
        .catch(() => setFound({ query: term, topics: [] }));
    }, 250);
    return () => clearTimeout(timer);
  }, [term, searching]);

  if (subjects === null) return <Loader className="py-24" />;

  // Subjects with notes first; the rest stay visible but dimmed so students know they're coming.
  const withNotes = subjects.filter((s) => s.topicCount > 0);
  const withoutNotes = subjects.filter((s) => s.topicCount === 0);
  const results = found?.query === term ? found.topics : null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Study</h1>
        <p className="text-slate-500 dark:text-slate-400">Short notes for every topic. Read a topic, then practise it.</p>
      </div>

      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics"
          aria-label="Search topics"
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {searching ? (
        <section aria-label="Search results" className="space-y-2">
          {results === null ? (
            <Loader className="py-10" />
          ) : results.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No topics match &ldquo;{term}&rdquo;.</p>
          ) : (
            results.map((t) => (
              <Link
                key={t.id}
                href={`/study/topic/${t.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl glass-panel hover:-translate-y-0.5 hover:shadow-lg transition-all"
              >
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{t.name}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{t.subject.name}</span>
                </span>
                {t.notesAccess === "PREMIUM" && <PremiumBadge />}
              </Link>
            ))
          )}
        </section>
      ) : (
        <>
          {resume && (
            <section aria-label="Continue reading" className="rounded-3xl bg-indigo-600 text-white p-6 md:p-8 space-y-5 shadow-lg shadow-indigo-600/20">
              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-white/20">In progress</span>
              <div>
                <h2 className="text-2xl font-bold leading-tight">{resume.name}</h2>
                <p className="text-indigo-100 text-sm mt-1">{resume.subject.name}</p>
              </div>
              <div className="space-y-2">
                <ProgressBar value={resume.readNotes} max={resume.totalNotes} label={`${resume.name} progress`} tone="onPrimary" />
                <p className="text-xs text-indigo-100">{resume.readNotes} of {resume.totalNotes} sections read</p>
              </div>
              <Link
                href={`/study/topic/${resume.id}`}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-full bg-slate-950 text-white font-semibold hover:bg-slate-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                Continue reading
              </Link>
            </section>
          )}

          <section aria-labelledby="subjects-heading" className="space-y-4">
            <h2 id="subjects-heading" className="text-xl font-bold">Subjects</h2>

            {failed ? (
              <p className="glass-panel p-8 rounded-2xl text-center text-slate-500">Couldn&apos;t load your subjects. Please refresh.</p>
            ) : withNotes.length === 0 ? (
              <p className="glass-panel p-8 rounded-2xl text-center text-slate-500">Notes are being written. Check back soon.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {withNotes.map((s) => (
                  <Link
                    key={s.id}
                    href={`/study/subject/${s.id}`}
                    className="glass-panel rounded-2xl p-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-lg transition-all"
                  >
                    <span className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <SubjectIcon name={s.name} />
                    </span>
                    <span className="font-semibold leading-snug">{s.name}</span>
                    <span className="mt-auto space-y-1.5">
                      <ProgressBar value={s.completedTopics} max={s.topicCount} label={`${s.name} progress`} />
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {s.completedTopics} of {s.topicCount} topic{s.topicCount === 1 ? "" : "s"} done
                      </span>
                    </span>
                  </Link>
                ))}
                {withoutNotes.map((s) => (
                  <div key={s.id} className="rounded-2xl p-5 flex flex-col gap-4 border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-600">
                    <span className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center">
                      <SubjectIcon name={s.name} />
                    </span>
                    <span className="font-semibold leading-snug">{s.name}</span>
                    <span className="mt-auto text-xs">Notes coming soon</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
