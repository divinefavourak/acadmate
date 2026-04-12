"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "./components/StatCard";

interface AnalyticsData {
  totalTests: number;
  averageScore: number;
  bestScore: number;
  subjectPerformance: { subjectId: string; name: string; percentage: number }[];
}

interface ResultEntry {
  id: string;
  score: number;
  correct: number;
  totalQuestions: number;
  createdAt: string;
  examSession: { id: string; mode: string; status: string };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function modeLabel(mode: string) {
  if (mode === "MOCK") return "Full UTME Mock";
  if (mode === "PRACTICE") return "Practice Session";
  if (mode === "TOPIC") return "Topic Practice";
  return mode;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [analyticsRes, resultsRes] = await Promise.all([
          fetch("/api/analytics"),
          fetch("/api/results?limit=5"),
        ]);
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
        if (resultsRes.ok) {
          const data = await resultsRes.json();
          setResults(data.results ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const bestSubject = analytics?.subjectPerformance?.sort((a, b) => b.percentage - a.percentage)[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Welcome back! 👋</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Here is a summary of your recent UTME preparation.</p>
        </div>
        <Link href="/exam/new" className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 sm:py-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start New Exam
        </Link>
      </div>

      {/* Stats Grid — 2x2 on Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard
          title="Avg Score"
          value={loading ? "—" : analytics ? `${Math.round(analytics.averageScore)}%` : "—"}
          subtitle={loading ? "…" : analytics ? `${analytics.totalTests} exams` : "—"}
          trend="neutral"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        />
        <StatCard
          title="Exams"
          value={loading ? "—" : String(analytics?.totalTests ?? 0)}
          subtitle="Total taken"
          trend="neutral"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
        />
        <StatCard
          title="Best Subj"
          value={loading ? "—" : bestSubject?.name ?? "—"}
          subtitle={bestSubject ? `${bestSubject.percentage}% acc` : "—"}
          trend={bestSubject ? "up" : "neutral"}
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>}
        />
        <StatCard
          title="Best Score"
          value={loading ? "—" : analytics ? `${Math.round(analytics.bestScore)}%` : "—"}
          subtitle="Result"
          trend="up"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
        />
      </div>

      {/* Recent Exams List */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold">Recent Exams</h2>
          <Link href="/results" className="text-indigo-500 font-medium hover:text-indigo-600 text-sm">View All</Link>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm py-4 text-center">Loading results…</p>
        ) : results.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">No exams taken yet. Start your first exam above!</p>
        ) : (
          <>
            {/* Mobile Card List (Hidden on Desktop) */}
            <div className="md:hidden space-y-3">
              {results.map((r) => (
                <Link 
                  key={r.id} 
                  href={`/results/${r.id}`}
                  className="block p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/20 active:scale-[0.98] transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-900 dark:text-white">{modeLabel(r.examSession.mode)}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 uppercase tracking-wider">
                      Done
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                      {formatDate(r.createdAt)}
                    </div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">
                      {r.correct}/{r.totalQuestions} ({Math.round(r.score)}%)
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                    <th className="pb-3 font-medium">Exam Type</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Score</th>
                    <th className="pb-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {results.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`${i < results.length - 1 ? "border-b border-slate-200 dark:border-slate-800/50" : ""} hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors`}
                    >
                      <td className="py-4 font-medium">
                        <Link href={`/results/${r.id}`} className="hover:text-indigo-500 transition-colors">
                          {modeLabel(r.examSession.mode)}
                        </Link>
                      </td>
                      <td className="py-4 text-slate-500">{formatDate(r.createdAt)}</td>
                      <td className="py-4 font-bold text-indigo-600 dark:text-indigo-400">
                        {r.correct} / {r.totalQuestions} ({Math.round(r.score)}%)
                      </td>
                      <td className="py-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
