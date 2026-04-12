"use client";

import { useEffect, useState } from "react";
import StatCard from "../dashboard/components/StatCard";

interface AdminStats {
  totalStudents: number;
  totalQuestions: number;
  publishedQuestions: number;
  totalExams: number;
  totalImports: number;
  dailyExamActivity: { label: string; count: number }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data); })
      .finally(() => setLoading(false));
  }, []);

  const maxCount = stats ? Math.max(...stats.dailyExamActivity.map((d) => d.count), 1) : 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Platform Overview</h1>
          <p className="text-slate-500 dark:text-slate-400">Monitor Acadmate&apos;s overall performance and metrics.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Students"
          value={loading ? "—" : String(stats?.totalStudents ?? 0)}
          subtitle="Registered accounts"
          trend="neutral"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <StatCard
          title="Exams Conducted"
          value={loading ? "—" : String(stats?.totalExams ?? 0)}
          subtitle="All time"
          trend="neutral"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
        />
        <StatCard
          title="Published Questions"
          value={loading ? "—" : String(stats?.publishedQuestions ?? 0)}
          subtitle={loading ? "Loading…" : `of ${stats?.totalQuestions ?? 0} total`}
          trend="neutral"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>}
        />
        <StatCard
          title="Total Imports"
          value={loading ? "—" : String(stats?.totalImports ?? 0)}
          subtitle="Question imports"
          trend="neutral"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>}
        />
      </div>

      {/* Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-6">Exam Activity (Last 7 Days)</h2>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-2 px-4">
              {(stats?.dailyExamActivity ?? []).map((day, i) => (
                <div key={i} className="w-full flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">{day.count > 0 ? day.count : ""}</span>
                  <div
                    className="w-full bg-indigo-500 rounded-t-sm transition-all"
                    style={{ height: `${Math.max((day.count / maxCount) * 100, day.count > 0 ? 4 : 0)}%`, minHeight: day.count > 0 ? "4px" : "0" }}
                  />
                  <span className="text-xs text-slate-500 font-medium">{day.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-6">Question Bank</h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Published</span>
                <span className="text-sm text-emerald-500 font-bold">
                  {loading ? "—" : stats ? `${stats.totalQuestions > 0 ? Math.round((stats.publishedQuestions / stats.totalQuestions) * 100) : 0}%` : "—"}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: stats && stats.totalQuestions > 0 ? `${Math.round((stats.publishedQuestions / stats.totalQuestions) * 100)}%` : "0%" }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Unpublished</span>
                <span className="text-sm text-amber-500 font-bold">
                  {loading ? "—" : stats ? `${stats.totalQuestions - stats.publishedQuestions}` : "—"}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: stats && stats.totalQuestions > 0 ? `${Math.round(((stats.totalQuestions - stats.publishedQuestions) / stats.totalQuestions) * 100)}%` : "0%" }}
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Questions</span>
                <span className="font-bold">{loading ? "—" : stats?.totalQuestions ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
