"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ResultEntry {
  id: string;
  score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  totalQuestions: number;
  createdAt: string;
  examSession: { id: string; mode: string; status: string };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modeLabel(mode: string) {
  if (mode === "MOCK") return "Full UTME Mock";
  if (mode === "PRACTICE") return "Practice Session";
  if (mode === "TOPIC") return "Topic Practice";
  return mode;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function ResultsPage() {
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 10;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/results?limit=${limit}&offset=${page * limit}`)
      .then((r) => r.ok ? r.json() : { results: [], total: 0 })
      .then((data) => {
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Exams</h1>
        <p className="text-slate-500 dark:text-slate-400">Your complete exam history.</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        {loading ? (
          <p className="text-slate-500 text-sm py-8 text-center">Loading…</p>
        ) : results.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-slate-500">No exams taken yet.</p>
            <Link href="/exam/new" className="btn-primary inline-block">Start Your First Exam</Link>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {results.map((r) => (
                <Link key={r.id} href={`/results/${r.id}`}
                  className="block p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/20 active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">{modeLabel(r.examSession.mode)}</span>
                    <span className={`text-lg font-bold ${scoreColor(r.score)}`}>{Math.round(r.score)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{formatDate(r.createdAt)}</span>
                    <span>
                      <span className="text-emerald-600 dark:text-emerald-400">{r.correct}✓</span>
                      {" · "}
                      <span className="text-red-500">{r.incorrect}✗</span>
                      {" · "}
                      <span>{r.unanswered} blank</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Score</th>
                    <th className="pb-3 font-medium">Correct</th>
                    <th className="pb-3 font-medium">Wrong</th>
                    <th className="pb-3 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {results.map((r, i) => (
                    <tr key={r.id}
                      className={`${i < results.length - 1 ? "border-b border-slate-200 dark:border-slate-800/50" : ""} hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors`}>
                      <td className="py-4 font-medium">{modeLabel(r.examSession.mode)}</td>
                      <td className="py-4 text-slate-500">{formatDate(r.createdAt)}</td>
                      <td className={`py-4 font-bold ${scoreColor(r.score)}`}>{Math.round(r.score)}%</td>
                      <td className="py-4 text-emerald-600 dark:text-emerald-400">{r.correct}</td>
                      <td className="py-4 text-red-600 dark:text-red-400">{r.incorrect}</td>
                      <td className="py-4 text-right">
                        <Link href={`/results/${r.id}`} className="text-indigo-500 hover:text-indigo-600 font-medium text-xs">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-500">
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
