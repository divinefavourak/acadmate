"use client";

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api/client";

interface ProseEntry {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  isPublished: boolean;
  _count: { sections: number; questions: number };
}

export default function ProsePage() {
  const [texts, setTexts] = useState<ProseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ title: "", author: "", year: "", summary: "", themes: "" });

  function loadTexts() {
    setLoading(true);
    apiClient<{ texts: ProseEntry[] }>("/admin/prose")
      .then((data) => setTexts(data.texts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTexts(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim()) { setFormError("Title is required."); return; }

    setSaving(true);
    try {
      await apiClient("/admin/prose", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          author: form.author || undefined,
          year: form.year ? Number(form.year) : undefined,
          summary: form.summary || undefined,
          themes: form.themes || undefined,
        }),
      });
      setForm({ title: "", author: "", year: "", summary: "", themes: "" });
      setShowForm(false);
      loadTexts();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Failed to create prose text.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(id: string, current: boolean) {
    await fetch(`/api/admin/prose/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !current }),
    });
    setTexts((prev) => prev.map((t) => t.id === id ? { ...t, isPublished: !current } : t));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Prose Library</h1>
          <p className="text-slate-400">Manage literature texts for the Lekki Headmaster section.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Add Prose
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">New Prose Text</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Things Fall Apart"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Author</label>
                <input
                  type="text"
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder="e.g. Chinua Achebe"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Year Published</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  placeholder="e.g. 1958"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Themes (comma-separated)</label>
                <input
                  type="text"
                  value={form.themes}
                  onChange={(e) => setForm((f) => ({ ...f, themes: e.target.value }))}
                  placeholder="e.g. colonialism, identity, tradition"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Summary</label>
              <textarea
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Brief summary of the text…"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-400">{formError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Create Prose Text"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        {loading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
        ) : texts.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No prose texts added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Author</th>
                  <th className="pb-3 font-medium">Year</th>
                  <th className="pb-3 font-medium">Sections</th>
                  <th className="pb-3 font-medium">Questions</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {texts.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`${i < texts.length - 1 ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}
                  >
                    <td className="py-3 font-medium text-white">{t.title}</td>
                    <td className="py-3 text-slate-400">{t.author ?? "—"}</td>
                    <td className="py-3 text-slate-400">{t.year ?? "—"}</td>
                    <td className="py-3 text-slate-300">{t._count.sections}</td>
                    <td className="py-3 text-slate-300">{t._count.questions}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => togglePublish(t.id, t.isPublished)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          t.isPublished
                            ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        }`}
                      >
                        {t.isPublished ? "Published" : "Unpublished"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
