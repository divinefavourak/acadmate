"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProseText {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  summary: string | null;
  _count: { questions: number; sections: number };
}

export default function ProseLandingPage() {
  const [texts, setTexts] = useState<ProseText[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/prose")
      .then((r) => r.ok ? r.json() : { texts: [] })
      .then((data) => setTexts(data.texts ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Prose Preparation</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Study recommended UTME literature texts and practise prose-linked questions.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="glass-panel p-6 rounded-2xl animate-pulse h-48" />
          ))}
        </div>
      ) : texts.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center">
          <p className="text-slate-500">No prose texts are available yet. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {texts.map((t) => (
            <Link
              key={t.id}
              href={`/prose/${t.id}`}
              className="glass-panel p-6 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all group block"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full">
                  {t._count.questions} question{t._count.questions !== 1 ? "s" : ""}
                </span>
              </div>

              <h2 className="text-xl font-bold mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {t.title}
              </h2>
              {t.author && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  by {t.author}{t.year ? ` (${t.year})` : ""}
                </p>
              )}
              {t.summary && (
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {t.summary}
                </p>
              )}

              <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <span>{t._count.sections} section{t._count.sections !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span className="text-indigo-500 font-semibold group-hover:underline">Study now →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
