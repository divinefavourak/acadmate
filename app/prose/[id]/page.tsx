"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";

interface ProseSection {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
}

interface ProseDetail {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  summary: string | null;
  themes: string | null;
  sections: ProseSection[];
}

interface ProseQuestion {
  id: string;
  text: string;
  difficulty: string;
  year: number | null;
  options: { id: string; label: string; text: string }[];
}

export default function ProseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [prose, setProse] = useState<ProseDetail | null>(null);
  const [questions, setQuestions] = useState<ProseQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "read" | "questions">("overview");
  const [activeChapter, setActiveChapter] = useState(0);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      apiClient<{ text: ProseDetail }>(`/prose/${id}`),
      apiClient<{ questions: ProseQuestion[] }>(`/prose/${id}/questions?limit=100`),
    ]).then(([proseResult, qResult]) => {
      if (proseResult.status === "rejected") { setError("Failed to load prose content."); return; }
      setProse(proseResult.value.text);
      if (qResult.status === "fulfilled") setQuestions(qResult.value.questions ?? []);
    }).catch(() => setError("Failed to load prose content."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStartPractice() {
    if (questions.length === 0) return;
    setStarting(true);
    try {
      const data = await apiClient<{ examSession: { id: string } }>("/exams", {
        method: "POST",
        body: JSON.stringify({ mode: "PRACTICE", proseTextId: id, questionCount: questions.length }),
      });
      router.push(`/exam/${data.examSession.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start practice session.");
      setStarting(false);
    }
  }

  const themes = prose?.themes ? prose.themes.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const sortedSections = prose?.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/2" />
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  if (error || !prose) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-500">{error || "Prose text not found."}</p>
        <Link href="/prose" className="text-indigo-500 hover:underline text-sm">← Back to Prose</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back link */}
      <Link href="/prose" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-500 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Prose
      </Link>

      {/* Hero */}
      <div className="glass-panel p-8 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{prose.title}</h1>
            {prose.author && (
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                by <span className="font-medium text-slate-700 dark:text-slate-300">{prose.author}</span>
                {prose.year ? ` · ${prose.year}` : ""}
              </p>
            )}
            {themes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {themes.map((theme) => (
                  <span key={theme} className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                    {theme}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{sortedSections.length} chapter{sortedSections.length !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{questions.length} practice question{questions.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          {questions.length > 0 && (
            <button
              onClick={handleStartPractice}
              disabled={starting}
              className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {starting ? "Starting…" : `Practice ${questions.length} Questions`}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {([
          { key: "overview", label: "Overview" },
          { key: "read", label: `Read (${sortedSections.length} chapters)` },
          { key: "questions", label: `Questions (${questions.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {prose.summary ? (
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="font-bold text-lg mb-3">Summary</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{prose.summary}</p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No summary available yet.</p>
          )}
          {themes.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="font-bold text-lg mb-4">Key Themes</h2>
              <ul className="space-y-2">
                {themes.map((theme) => (
                  <li key={theme} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    <span className="capitalize">{theme}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sortedSections.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="font-bold text-lg mb-4">Chapters</h2>
              <ol className="space-y-2">
                {sortedSections.map((s, i) => (
                  <li key={s.id}>
                    <button
                      onClick={() => { setActiveTab("read"); setActiveChapter(i); }}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline text-left"
                    >
                      {s.title}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {activeTab === "read" && (
        <div className="flex gap-6">
          {/* Chapter sidebar */}
          {sortedSections.length > 1 && (
            <aside className="hidden md:block w-52 flex-shrink-0">
              <div className="sticky top-6 space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Chapters</p>
                {sortedSections.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveChapter(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeChapter === i
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </aside>
          )}

          {/* Reader */}
          <div className="flex-1 min-w-0">
            {sortedSections.length === 0 ? (
              <p className="text-slate-500 text-sm">No chapters have been loaded yet.</p>
            ) : (
              <div className="glass-panel p-8 rounded-2xl">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">
                  {sortedSections[activeChapter]?.title}
                </h2>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  {sortedSections[activeChapter]?.content
                    .split("\n\n")
                    .filter(Boolean)
                    .map((para, i) => (
                      <p key={i} className="text-base leading-8 text-slate-700 dark:text-slate-300 mb-5">
                        {para.trim()}
                      </p>
                    ))}
                </div>

                {/* Chapter navigation */}
                <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setActiveChapter((c) => Math.max(0, c - 1))}
                    disabled={activeChapter === 0}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Previous
                  </button>
                  <span className="text-xs text-slate-400">
                    {activeChapter + 1} / {sortedSections.length}
                  </span>
                  <button
                    onClick={() => setActiveChapter((c) => Math.min(sortedSections.length - 1, c + 1))}
                    disabled={activeChapter === sortedSections.length - 1}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "questions" && (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <p className="text-slate-500 text-sm">No practice questions are available yet.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {questions.length} question{questions.length !== 1 ? "s" : ""} available.
                Start a practice session to answer them with auto-grading.
              </p>
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="glass-panel p-4 rounded-xl">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center flex-shrink-0 text-slate-500 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{q.text}</p>
                        <div className="flex gap-3 mt-2 text-xs text-slate-500">
                          <span className={`font-medium ${q.difficulty === "EASY" ? "text-emerald-500" : q.difficulty === "HARD" ? "text-red-500" : "text-amber-500"}`}>
                            {q.difficulty}
                          </span>
                          {q.year && <span>· {q.year}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleStartPractice}
                disabled={starting}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {starting ? "Starting…" : "Start Practice Session"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
