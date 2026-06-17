"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

interface MockExam {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isActive: boolean;
  _count: { participants: number; questions: number; sessions: number };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminMockPage() {
  const [exams, setExams] = useState<MockExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient<MockExam[]>("/api/admin/mock")
      .then(setExams)
      .catch(() => setError("Failed to load mock exams"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const exam = await apiClient<MockExam>("/api/admin/mock", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), durationMinutes }),
      });
      setExams((prev) => [exam, ...prev]);
      setTitle(""); setDescription(""); setStartsAt(""); setEndsAt("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create exam");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      const updated = await apiClient<MockExam>(`/api/admin/mock/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !current }),
      });
      setExams((prev) => prev.map((e) => (e.id === id ? { ...e, isActive: updated.isActive } : e)));
    } catch {
      setError("Failed to update exam");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Mock Exams</h1>
        <p className="text-slate-500 dark:text-slate-400">Create and manage one-time mock exam events with phone-gated access.</p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl space-y-4">
        <h2 className="font-semibold text-lg">New Mock Exam</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unilag Post-UTME Mock 2026"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description shown on the landing page"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Starts at</label>
            <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ends at</label>
            <input required type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Duration per attempt</label>
            <div className="flex items-center gap-4">
              <input type="range" min={10} max={180} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer" />
              <span className="w-20 text-right font-semibold text-indigo-600 dark:text-indigo-400">{durationMinutes} min</span>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={creating}
          className="btn-primary flex items-center gap-2 disabled:opacity-60">
          {creating ? "Creating…" : "Create Mock Exam"}
        </button>
      </form>

      {/* Exam list */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">All Mock Exams</h2>
        {loading ? <Loader className="py-8" /> : exams.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center text-slate-400 text-sm">No mock exams yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {exams.map((exam) => (
              <div key={exam.id} className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{exam.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{exam.durationMinutes} min · {exam._count.questions} questions</p>
                  </div>
                  <button onClick={() => toggleActive(exam.id, exam.isActive)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${exam.isActive
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
                      : "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}`}>
                    {exam.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
                <div className="text-xs text-slate-400 space-y-0.5">
                  <p>Starts: {fmt(exam.startsAt)}</p>
                  <p>Ends: {fmt(exam.endsAt)}</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <span><b className="text-slate-700 dark:text-slate-200">{exam._count.participants}</b> participants</span>
                  <span><b className="text-slate-700 dark:text-slate-200">{exam._count.sessions}</b> attempts</span>
                </div>
                <Link href={`/admin/mock/${exam.id}`}
                  className="text-center px-3 py-2 rounded-xl text-sm font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors">
                  Manage →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
