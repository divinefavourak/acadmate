"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

interface AnalyticsData {
  totalTests: number;
  averageScore: number;
  bestScore: number;
  recentTrend: { id: string; score: number; mode: string; date: string }[];
  subjectPerformance: { subjectId: string; name: string; correct: number; total: number; percentage: number }[];
  weakTopics: { topicId: string; name: string; correct: number; total: number; percentage: number }[];
}

function ScoreBar({ percentage, color = "bg-indigo-500" }: { percentage: number; color?: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<AnalyticsData>("/api/analytics")
      .then((d) => { if (d) setData(d); })
      .catch((err) => {
        console.error("Failed to load analytics", err);
        setError("Failed to load analytics. Please refresh.");
      })
      .finally(() => setLoading(false));
  }, []);

  const maxTrend = data ? Math.max(...data.recentTrend.map((t) => t.score), 1) : 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400">Track your performance over time.</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Total Exams", value: loading ? "—" : String(data?.totalTests ?? 0) },
          { label: "Average Score", value: loading ? "—" : `${Math.round(data?.averageScore ?? 0)}%` },
          { label: "Best Score", value: loading ? "—" : `${Math.round(data?.bestScore ?? 0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="glass-panel p-6 rounded-2xl">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent Trend */}
      {!loading && data && data.recentTrend.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-6">Recent Score Trend</h2>
          <div className="h-48 flex items-end justify-between gap-3 px-2">
            {data.recentTrend.map((t, i) => (
              <div key={t.id} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-slate-500">{Math.round(t.score)}%</span>
                <div
                  className="w-full bg-indigo-500 rounded-t-sm"
                  style={{ height: `${(t.score / maxTrend) * 100}%` }}
                />
                <span className="text-xs text-slate-500">#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Performance */}
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-6">Subject Performance</h2>
          {loading ? (
            <p className="text-slate-500 text-sm text-center py-4">Loading…</p>
          ) : !data || data.subjectPerformance.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No data yet. Complete some exams first.</p>
          ) : (
            <div className="space-y-5">
              {data.subjectPerformance
                .sort((a, b) => b.percentage - a.percentage)
                .map((s) => (
                  <div key={s.subjectId}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className={`text-sm font-bold ${s.percentage >= 70 ? "text-emerald-500" : s.percentage >= 50 ? "text-amber-500" : "text-red-500"}`}>
                        {s.percentage}%
                      </span>
                    </div>
                    <ScoreBar
                      percentage={s.percentage}
                      color={s.percentage >= 70 ? "bg-emerald-500" : s.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}
                    />
                    <p className="text-xs text-slate-500 mt-1">{s.correct}/{s.total} correct</p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Weak Topics */}
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-6">Topics to Improve</h2>
          {loading ? (
            <p className="text-slate-500 text-sm text-center py-4">Loading…</p>
          ) : !data || data.weakTopics.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              {data?.totalTests ? "No weak topics detected — great work!" : "Complete more exams to see weak topics."}
            </p>
          ) : (
            <div className="space-y-5">
              {data.weakTopics.map((t) => (
                <div key={t.topicId}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-sm font-bold text-red-500">{t.percentage}%</span>
                  </div>
                  <ScoreBar percentage={t.percentage} color="bg-red-500" />
                  <p className="text-xs text-slate-500 mt-1">{t.correct}/{t.total} correct</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
