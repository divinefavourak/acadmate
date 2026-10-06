"use client";

import { useCallback, useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import ConfirmModal from "@/app/components/ConfirmModal";
import MarkdownEditor from "@/app/components/MarkdownEditor";
import { apiClient, ApiError } from "@/lib/api/client";
import NotesImportPanel from "./NotesImportPanel";

type NotesAccess = "FREE" | "PREMIUM";

interface SubjectOption {
  id: string;
  name: string;
}

interface TopicRow {
  id: string;
  name: string;
  isActive: boolean;
  notesAccess: NotesAccess;
  totalNotes: number;
  publishedNotes: number;
}

interface Note {
  id: string;
  title: string;
  body: string;
  isPublished: boolean;
}

interface TopicDetail {
  topic: { id: string; name: string; notesAccess: NotesAccess };
  notes: Note[];
}

/** The section being written. `id: null` is a new, unsaved section. */
interface Draft {
  id: string | null;
  title: string;
  body: string;
}

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export default function AdminNotesPage() {
  const [subjects, setSubjects] = useState<SubjectOption[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  // Stored with the subject/topic they belong to, so a stale list is never shown under a new selection.
  const [overview, setOverview] = useState<{ subjectId: string; topics: TopicRow[] } | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TopicDetail | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const topics = overview?.subjectId === subjectId ? overview.topics : null;
  const current = detail?.topic.id === topicId ? detail : null;

  useEffect(() => {
    apiClient<{ subjects: SubjectOption[] }>("/api/admin/subjects")
      .then((data) => {
        const list = data?.subjects ?? [];
        setSubjects(list);
        setSubjectId((prev) => prev || list[0]?.id || "");
      })
      .catch((err) => {
        setSubjects([]);
        setError(message(err, "Failed to load subjects. Please refresh."));
      });
  }, []);

  const refreshTopics = useCallback((sid: string) => {
    return apiClient<{ topics: TopicRow[] }>(`/api/admin/notes/overview?subjectId=${sid}`)
      .then((data) => setOverview({ subjectId: sid, topics: data.topics }))
      .catch((err) => setError(message(err, "Failed to load topics.")));
  }, []);

  const refreshDetail = useCallback((tid: string) => {
    return apiClient<TopicDetail>(`/api/admin/topics/${tid}/notes`)
      .then(setDetail)
      .catch((err) => setError(message(err, "Failed to load sections.")));
  }, []);

  useEffect(() => {
    if (subjectId) void refreshTopics(subjectId);
  }, [subjectId, refreshTopics]);

  useEffect(() => {
    if (topicId) void refreshDetail(topicId);
  }, [topicId, refreshDetail]);

  function refreshAll() {
    if (subjectId) void refreshTopics(subjectId);
    if (topicId) void refreshDetail(topicId);
  }

  /** Runs a change, then reloads; errors land in the banner. */
  async function run(action: () => Promise<unknown>, fallback: string) {
    setError("");
    try {
      await action();
      refreshAll();
      return true;
    } catch (err) {
      setError(message(err, fallback));
      return false;
    }
  }

  async function saveDraft(publish: boolean | undefined) {
    if (!draft || !topicId) return;
    if (uploading > 0) return setError("Wait for image uploads to finish before saving.");
    if (!draft.title.trim()) return setError("Give the section a title.");
    if (!draft.body.trim()) return setError("The section has no content yet.");

    setSaving(true);
    const body = JSON.stringify({
      title: draft.title,
      body: draft.body,
      ...(publish !== undefined && { isPublished: publish }),
    });
    const ok = await run(
      () =>
        draft.id
          ? apiClient(`/api/admin/notes/${draft.id}`, { method: "PATCH", body })
          : apiClient(`/api/admin/topics/${topicId}/notes`, { method: "POST", body }),
      "Could not save the section.",
    );
    setSaving(false);
    if (ok) setDraft(null);
  }

  function move(index: number, by: -1 | 1) {
    if (!current) return;
    const ids = current.notes.map((n) => n.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(
      () => apiClient(`/api/admin/topics/${current.topic.id}/notes/order`, { method: "PUT", body: JSON.stringify({ ids }) }),
      "Could not reorder sections.",
    );
  }

  function updateSettings(settings: { notesAccess?: NotesAccess; publishAll?: boolean }) {
    if (!topicId) return;
    void run(
      () => apiClient(`/api/admin/topics/${topicId}/notes-settings`, { method: "PATCH", body: JSON.stringify(settings) }),
      "Could not update the topic.",
    );
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    await run(() => apiClient(`/api/admin/notes/${toDelete.id}`, { method: "DELETE" }), "Could not delete the section.");
    setDeleting(false);
    // Don't leave the editor open on a section that no longer exists.
    if (draft?.id === toDelete.id) setDraft(null);
    setToDelete(null);
  }

  if (subjects === null) return <Loader className="h-80" />;

  const editingExisting = draft?.id ? current?.notes.find((n) => n.id === draft.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Topic Notes</h1>
          <p className="text-slate-400">Short reading sections for each topic. Students only see published sections.</p>
        </div>
        <button
          onClick={() => setShowImport((v) => !v)}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 hover:bg-slate-800 transition-colors"
        >
          {showImport ? "Close import" : "Bulk import"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}

      {showImport && <NotesImportPanel onImported={refreshAll} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Topics ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <select
            value={subjectId}
            onChange={(e) => { setSubjectId(e.target.value); setTopicId(null); setDraft(null); }}
            aria-label="Subject"
            className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            {topics === null ? (
              <Loader className="h-40" />
            ) : topics.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">This subject has no topics yet. Add them under Subjects.</p>
            ) : (
              <ul className="divide-y divide-slate-800/60 max-h-[70vh] overflow-y-auto">
                {topics.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => { setTopicId(t.id); setDraft(null); setError(""); }}
                      aria-current={t.id === topicId}
                      className={`w-full text-left px-4 py-3 transition-colors ${t.id === topicId ? "bg-indigo-600/20" : "hover:bg-slate-800/50"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{t.name}</span>
                        {t.notesAccess === "PREMIUM" && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">Premium</span>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        {t.totalNotes === 0
                          ? "No sections"
                          : `${t.publishedNotes} of ${t.totalNotes} published`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Sections of the selected topic ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {!topicId ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center text-slate-500 text-sm">
              Pick a topic to write its notes.
            </div>
          ) : !current ? (
            <Loader className="h-60" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-xl font-bold">{current.topic.name}</h2>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden text-xs" role="group" aria-label="Who can read these notes">
                    {(["FREE", "PREMIUM"] as const).map((a) => (
                      <button
                        key={a}
                        aria-pressed={current.topic.notesAccess === a}
                        onClick={() => current.topic.notesAccess !== a && updateSettings({ notesAccess: a })}
                        className={`px-3 py-1.5 font-medium transition-colors ${current.topic.notesAccess === a ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        {a === "FREE" ? "Free" : "Premium"}
                      </button>
                    ))}
                  </div>
                  {current.notes.some((n) => !n.isPublished) && (
                    <button
                      onClick={() => updateSettings({ publishAll: true })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                    >
                      Publish all
                    </button>
                  )}
                </div>
              </div>

              {current.notes.length === 0 && !draft && (
                <p className="text-sm text-slate-500">No sections yet. Add the first one below.</p>
              )}

              <ol className="space-y-2">
                {current.notes.map((n, i) => (
                  <li
                    key={n.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${draft?.id === n.id ? "border-indigo-500/50 bg-indigo-600/10" : "border-slate-800 bg-slate-900"}`}
                  >
                    <span className="w-6 text-center text-sm font-bold text-slate-500 tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-sm truncate">{n.title}</span>
                      <span className={`text-xs ${n.isPublished ? "text-emerald-400" : "text-amber-400"}`}>
                        {n.isPublished ? "Published" : "Draft"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${n.title} up`} className="px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-30">↑</button>
                      <button onClick={() => move(i, 1)} disabled={i === current.notes.length - 1} aria-label={`Move ${n.title} down`} className="px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-30">↓</button>
                      <button onClick={() => { setError(""); setDraft({ id: n.id, title: n.title, body: n.body }); }} className="px-2 py-1 rounded-lg text-indigo-300 hover:bg-slate-800">Edit</button>
                      <button onClick={() => setToDelete(n)} className="px-2 py-1 rounded-lg text-red-400 hover:bg-slate-800">Delete</button>
                    </span>
                  </li>
                ))}
              </ol>

              {draft ? (
                <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
                  <div>
                    <label htmlFor="note-title" className="text-sm font-medium block mb-1">Section title</label>
                    <input
                      id="note-title"
                      type="text"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      placeholder="e.g. What is a cell?"
                      maxLength={160}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  {/* Keyed per section so switching sections gets a fresh editor: an
                      upload still in flight for the previous one can't leak into this one. */}
                  <MarkdownEditor
                    key={draft.id ?? "new"}
                    label="Content (Markdown)"
                    value={draft.body}
                    onChange={(next) =>
                      setDraft((d) => (d ? { ...d, body: typeof next === "function" ? next(d.body) : next } : d))
                    }
                    folder="notes"
                    rows={14}
                    placeholder={"Keep it short: one idea per section.\n\nUse **bold** for key terms, - for lists, and $x^2$ for maths."}
                    onError={setError}
                    onUploadingChange={setUploading}
                  />

                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <button onClick={() => setDraft(null)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white">
                      Cancel
                    </button>
                    {editingExisting?.isPublished ? (
                      <>
                        <button onClick={() => saveDraft(false)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 transition-colors">
                          Save and unpublish
                        </button>
                        <button onClick={() => saveDraft(undefined)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors">
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => saveDraft(undefined)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 hover:bg-slate-800 disabled:opacity-50 transition-colors">
                          Save draft
                        </button>
                        <button onClick={() => saveDraft(true)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors">
                          {saving ? "Saving…" : "Save and publish"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setError(""); setDraft({ id: null, title: "", body: "" }); }}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium border border-dashed border-slate-700 text-slate-300 hover:bg-slate-800/50 transition-colors"
                >
                  + Add section
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Delete this section?"
        message={toDelete ? `"${toDelete.title}" will be removed for everyone, along with students' progress on it.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
