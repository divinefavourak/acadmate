"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

interface MockExam {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isActive: boolean;
  _count: { participants: number; questions: number; sessions: number };
}

function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MockExamOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<MockExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isActive, setIsActive] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function copyLink(key: string, url: string) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  useEffect(() => {
    apiClient<MockExam>(`/api/admin/mock/${id}`)
      .then((e) => {
        setExam(e);
        setTitle(e.title);
        setSlug(e.slug ?? "");
        setDescription(e.description ?? "");
        setStartsAt(toLocal(e.startsAt));
        setEndsAt(toLocal(e.endsAt));
        setDurationMinutes(e.durationMinutes);
        setIsActive(e.isActive);
      })
      .catch(() => setError("Failed to load exam"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(""); setSuccess("");
    try {
      const updated = await apiClient<MockExam>(`/api/admin/mock/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title, slug, description: description || undefined, startsAt: startsAt ? new Date(startsAt).toISOString() : undefined, endsAt: endsAt ? new Date(endsAt).toISOString() : undefined, durationMinutes, isActive }),
      });
      setExam(updated);
      setSuccess("Saved!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader className="py-12" />;
  if (!exam) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">{exam.title}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {exam._count.participants} participants · {exam._count.questions} questions · {exam._count.sessions} attempts
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="font-semibold">Edit Details</h3>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Custom link (slug)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. unilag-mock-2026"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          <p className="text-xs text-slate-400">Shareable as /mock/your-slug. Leave blank to use the default link.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Starts at</label>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ends at</label>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Duration per attempt</label>
          <div className="flex items-center gap-4">
            <input type="range" min={10} max={180} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="flex-1 accent-indigo-500 cursor-pointer" />
            <span className="w-20 text-right font-semibold text-indigo-600 dark:text-indigo-400">{durationMinutes} min</span>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsActive((v) => !v); } }}
            className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
          >
            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : ""}`} />
          </button>
          <span className="text-sm font-medium">{isActive ? "Active — visible to participants" : "Inactive — hidden from participants"}</span>
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-emerald-500">{success}</p>}
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      {/* Share links */}
      <div className="glass-panel p-5 rounded-2xl space-y-3">
        <h3 className="font-semibold text-sm">Participant Links</h3>
        {!exam.slug && (
          <p className="text-xs text-slate-400">Tip: set a custom slug above for shorter, branded links.</p>
        )}
        <div className="space-y-2">
          {(() => {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const base = `${origin}/mock/${exam.slug || id}`;
            const links = [
              { key: "exam", label: "Exam page", url: base },
              { key: "register", label: "Register", url: `${base}/register` },
              { key: "leaderboard", label: "Leaderboard", url: `${base}/leaderboard` },
            ];
            return links.map((l) => (
              <div key={l.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{l.label}</span>
                <code className="flex-1 min-w-0 truncate bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded text-xs text-slate-600 dark:text-slate-300">{l.url}</code>
                <button
                  type="button"
                  onClick={() => copyLink(l.key, l.url)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
                >
                  {copied === l.key ? "Copied!" : "Copy"}
                </button>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
