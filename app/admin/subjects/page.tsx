"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

interface SubjectEntry {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { questions: number; topics: number };
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function loadSubjects() {
    setLoading(true);
    apiClient<{ subjects: SubjectEntry[] }>("/api/admin/subjects")
      .then((data) => setSubjects(data?.subjects ?? []))
      .catch((err) => {
        console.error("Failed to load subjects", err);
        setError("Failed to load subjects. Please refresh.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSubjects(); }, []);

  async function toggleActive(id: string, current: boolean) {
    try {
      await apiClient(`/api/admin/subjects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !current }),
      });
      setSubjects((prev) =>
        prev.map((s) => s.id === id ? { ...s, isActive: !current } : s)
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update subject status.");
    }
  }

  function startEdit(s: SubjectEntry) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditCode(s.code);
    setEditDescription(s.description ?? "");
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const subjectId = editingId;
    if (!subjectId) return;
    const name = editName.trim();
    const code = editCode.trim().toUpperCase();
    if (!name || !code) { setEditError("Name and code are required."); return; }
    setEditSaving(true);
    setEditError("");
    try {
      await apiClient(`/api/admin/subjects/${subjectId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, code, description: editDescription.trim() || null }),
      });
      setSubjects((prev) => prev.map((s) =>
        s.id === subjectId ? { ...s, name, code, description: editDescription.trim() || null } : s
      ));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    const code = newCode.trim().toUpperCase();
    if (!name || !code) { setCreateError("Name and code are required."); return; }

    setSaving(true);
    setCreateError("");
    try {
      await apiClient("/api/admin/subjects", {
        method: "POST",
        body: JSON.stringify({ name, code }),
      });
      setNewName("");
      setNewCode("");
      setCreating(false);
      loadSubjects();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create subject.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Subjects</h1>
          <p className="text-slate-400">Manage exam subjects available for questions.</p>
        </div>
        {!creating && (
          <button
            onClick={() => { setCreating(true); setCreateError(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Subject
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {creating && (
        <form onSubmit={handleCreate} className="bg-slate-800/50 border border-indigo-700/50 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">New Subject</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-slate-400">Name <span className="text-red-400">*</span></label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. General Knowledge"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                autoFocus
              />
            </div>
            <div className="w-full sm:w-36 space-y-1">
              <label className="text-xs font-medium text-slate-400">Code <span className="text-red-400">*</span></label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="e.g. GK"
                maxLength={10}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>
          {createError && <p className="text-red-400 text-xs">{createError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-50 active:scale-95"
            >
              {saving ? "Saving…" : "Save Subject"}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(""); setNewCode(""); setCreateError(""); }}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        {loading ? (
          <Loader className="py-8" />
        ) : subjects.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No subjects found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Topics</th>
                  <th className="pb-3 font-medium">Questions</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, i) => (
                  <Fragment key={s.id}>
                    <tr
                      className={`${i < subjects.length - 1 && editingId !== s.id ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}
                    >
                      <td className="py-3">
                        <p className="font-medium text-white">{s.name}</p>
                        {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                      </td>
                      <td className="py-3 text-slate-400 font-mono">{s.code}</td>
                      <td className="py-3 text-slate-300">{s._count.topics}</td>
                      <td className="py-3 text-slate-300">{s._count.questions}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/questions?subjectId=${s.id}`}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                          >
                            View Questions
                          </Link>
                          <button
                            onClick={() => editingId === s.id ? setEditingId(null) : startEdit(s)}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(s.id, s.isActive)}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              s.isActive
                                ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                            }`}
                          >
                            {s.isActive ? "Active" : "Inactive"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === s.id && (
                      <tr className={`${i < subjects.length - 1 ? "border-b border-slate-800" : ""}`}>
                        <td colSpan={5} className="py-3 px-0">
                          <form onSubmit={handleSaveEdit} className="bg-slate-900/60 border border-indigo-700/40 rounded-xl p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-slate-400">Name</label>
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                              </div>
                              <div className="w-full sm:w-32 space-y-1">
                                <label className="text-xs font-medium text-slate-400">Code</label>
                                <input
                                  value={editCode}
                                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                  maxLength={10}
                                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-slate-400">Description (optional)</label>
                                <input
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                              </div>
                            </div>
                            {editError && <p className="text-red-400 text-xs">{editError}</p>}
                            <div className="flex gap-2">
                              <button type="submit" disabled={editSaving}
                                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                                {editSaving ? "Saving…" : "Save"}
                              </button>
                              <button type="button" onClick={() => setEditingId(null)}
                                className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors">
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
