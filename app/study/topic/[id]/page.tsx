"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import Loader from "@/app/components/Loader";
import { apiClient } from "@/lib/api/client";
import { PremiumBadge } from "../../components/StudyBits";
import type { TopicNotes } from "../../types";

const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
);

export default function StudyTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<TopicNotes | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient<TopicNotes>(`/api/study/topics/${id}`)
      .then((d) => {
        setData(d);
        setRead(new Set(d.notes.filter((n) => n.read).map((n) => n.id)));
        // Resume at the first section the student hasn't read yet.
        const firstUnread = d.notes.findIndex((n) => !n.read);
        setIndex(firstUnread === -1 ? 0 : firstUnread);
      })
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) {
    return (
      <div className="max-w-xl mx-auto glass-panel p-10 rounded-2xl text-center space-y-4">
        <p className="text-slate-500">We couldn&apos;t find notes for that topic.</p>
        <Link href="/study" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Back to Study</Link>
      </div>
    );
  }
  if (!data) return <Loader className="py-24" />;

  const { topic, notes } = data;
  const subjectHref = `/study/subject/${topic.subject.id}`;
  const note = notes[index];
  const isLast = index === notes.length - 1;
  const noteLocked = note.body === null;

  function goTo(i: number) {
    setIndex(i);
    // The page scrolls inside the layout's <main>, under a sticky header on mobile.
    topRef.current?.closest("main")?.scrollTo({ top: 0 });
  }

  function next() {
    // Moving on is what counts as having read a section. Progress is saved in
    // the background so a slow connection never blocks reading.
    if (!noteLocked && !read.has(note.id)) {
      setRead((prev) => new Set(prev).add(note.id));
      apiClient(`/api/study/notes/${note.id}/read`, { method: "POST" }).catch(() => {
        setRead((prev) => { const s = new Set(prev); s.delete(note.id); return s; });
      });
    }
    if (isLast) setFinished(true);
    else goTo(index + 1);
  }

  if (finished) {
    return (
      <div className="max-w-md mx-auto text-center py-10 space-y-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="mx-auto w-28 h-28 rounded-[2rem] bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        </motion.div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Topic complete!</h1>
          <p className="text-slate-500 dark:text-slate-400">
            You read all {notes.length} section{notes.length === 1 ? "" : "s"} of {topic.name}. Lock it in with a few questions.
          </p>
        </div>
        <div className="space-y-3">
          <Link
            href={`/exam/new?mode=TOPIC&subjectId=${topic.subject.id}&topicId=${topic.id}`}
            className="block px-6 py-4 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-semibold hover:opacity-90 transition-opacity"
          >
            Practise this topic
          </Link>
          <Link href={subjectHref} className="block px-6 py-4 rounded-full border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Back to {topic.subject.name}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-4">
        <Link href={subjectHref} className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <BackIcon />
          {topic.subject.name}
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{topic.name}</h1>
          {topic.notesAccess === "PREMIUM" && <PremiumBadge />}
        </div>

        {/* One segment per section; doubles as the progress bar and as navigation. */}
        <nav aria-label="Sections" className="space-y-2">
          <div className="flex gap-1.5">
            {notes.map((n, i) => (
              <button
                key={n.id}
                onClick={() => goTo(i)}
                aria-label={`Section ${i + 1}: ${n.title}${read.has(n.id) ? " (read)" : ""}`}
                aria-current={i === index ? "step" : undefined}
                className="flex-1 py-2 group"
              >
                <span
                  className={`block h-1.5 rounded-full transition-colors ${
                    i === index
                      ? "bg-indigo-600 dark:bg-indigo-400"
                      : read.has(n.id)
                      ? "bg-emerald-500"
                      : "bg-slate-200 dark:bg-slate-800 group-hover:bg-slate-300 dark:group-hover:bg-slate-700"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Section {index + 1} of {notes.length}</p>
        </nav>
      </header>

      <article className="glass-panel rounded-3xl p-6 md:p-10">
        <h2 className="text-xl md:text-2xl font-bold mb-5">{note.title}</h2>
        {noteLocked ? (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6 text-center space-y-4">
            <p className="font-semibold">The rest of this topic is for Premium students.</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Upgrade to read every section and unlock all Premium notes.</p>
            <Link href="/dashboard/upgrade" className="inline-block px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
              Go Premium
            </Link>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-img:rounded-xl prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {note.body}
            </ReactMarkdown>
          </div>
        )}
      </article>

      <div className="flex items-center justify-between gap-3 pb-8">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="px-5 py-3 rounded-full border border-slate-300 dark:border-slate-700 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Previous
        </button>
        {isLast && noteLocked ? (
          // A locked topic ends at the upgrade prompt, not at "complete".
          <Link href="/dashboard/upgrade" className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
            Go Premium
          </Link>
        ) : (
          <button
            onClick={next}
            className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            {isLast ? "Finish topic" : "Next section"}
          </button>
        )}
      </div>
    </div>
  );
}
