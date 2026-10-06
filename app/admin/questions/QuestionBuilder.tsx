"use client";

import { useEffect, useState } from "react";
import MathText from "@/app/components/MathText";
import ConfirmModal from "@/app/components/ConfirmModal";
import { apiClient } from "@/lib/api/client";
import { SCHOOLS } from "@/features/post-utme/constants";

export const OPTION_LABELS = ["A", "B", "C", "D"];

export const emptyForm = {
  subjectId: "",
  topicId: "",
  examType: "" as string,
  school: "",
  text: "",
  imageUrl: "",
  year: "",
  difficulty: "MEDIUM",
  options: OPTION_LABELS.map((label) => ({ label, text: "", isCorrect: false })),
  explanation: "",
};

export type QuestionForm = typeof emptyForm;

interface ListItem {
  id: string;
  text: string;
  isPublished: boolean;
  isFlagged: boolean;
}

interface Props {
  mode: "create" | "edit";
  form: QuestionForm;
  setForm: React.Dispatch<React.SetStateAction<QuestionForm>>;
  subjects: { id: string; name: string }[];
  /** Edit mode: a question's subject is fixed, so it is shown rather than chosen. */
  subjectName?: string;
  error: string;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onUploadImage: (file: File, setter: (url: string) => void, setUploading: (v: boolean) => void) => void;
  /** The list the builder was opened from, shown on the left for jumping between questions. */
  questions: ListItem[];
  activeId: string | null;
  loadingId: string | null;
  onOpenQuestion: (id: string) => void;
  onNew: () => void;
}

const field =
  "w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50";
// Compact selects/inputs in the footer strip.
const chip =
  "px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-40";

const DIFFICULTY_TONE: Record<string, string> = {
  EASY: "!border-emerald-500/40 !text-emerald-300",
  MEDIUM: "!border-amber-500/40 !text-amber-300",
  HARD: "!border-red-500/40 !text-red-300",
};

/** Two-pane question builder: the current list on the left, one question's editor on the right. */
export default function QuestionBuilder({
  mode, form, setForm, subjects, subjectName, error, saving, onSubmit, onClose,
  onUploadImage, questions, activeId, loadingId, onOpenQuestion, onNew,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [topics, setTopics] = useState<{ subjectId: string; list: { id: string; name: string }[] } | null>(null);
  // Snapshot of the form as opened. The parent remounts this component per
  // question (via `key`), so the snapshot always matches what was loaded.
  const [baseline] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== baseline;
  // What the admin tried to do while there were unsaved edits.
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!form.subjectId) return;
    const subjectId = form.subjectId;
    apiClient<{ topics: { id: string; name: string }[] }>(`/api/admin/topics?subjectId=${subjectId}`)
      .then((data) => setTopics({ subjectId, list: data.topics ?? [] }))
      .catch((err) => console.error("Failed to load topics", err));
  }, [form.subjectId]);

  const topicList = topics?.subjectId === form.subjectId ? topics.list : [];

  function guard(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }

  function setOption(idx: number, patch: { text?: string; isCorrect?: true }) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => {
        if (patch.isCorrect) return { ...opt, isCorrect: i === idx };
        return i === idx ? { ...opt, text: patch.text ?? opt.text } : opt;
      }),
    }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6 items-start">
      {/* ── Left: the list this builder was opened from ───────────────────── */}
      <aside className="hidden lg:flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-3 gap-3 max-h-[80vh] sticky top-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-200">Questions ({questions.length})</h2>
          <button
            type="button"
            onClick={() => guard(onNew)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            + New
          </button>
        </div>
        {questions.length === 0 ? (
          <p className="px-1 pb-2 text-xs text-slate-400">Questions from the list you were viewing appear here.</p>
        ) : (
          <ol className="space-y-2 overflow-y-auto pr-1">
            {questions.map((q, i) => {
              const active = q.id === activeId;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => !active && guard(() => onOpenQuestion(q.id))}
                    aria-current={active ? "true" : undefined}
                    disabled={loadingId === q.id}
                    className={`w-full text-left p-3 rounded-xl border transition-colors disabled:opacity-60 ${
                      active ? "bg-indigo-600/20 border-indigo-500" : "bg-slate-800/70 border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <span className="flex items-center gap-2 mb-1.5">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${active ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300"}`}>
                        {i + 1}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${q.isFlagged ? "text-red-400" : q.isPublished ? "text-emerald-400" : "text-amber-400"}`}>
                        {q.isFlagged ? "Flagged" : q.isPublished ? "Published" : "Draft"}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-300 line-clamp-2"><MathText text={q.text} /></span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </aside>

      {/* ── Right: the editor ─────────────────────────────────────────────── */}
      <form onSubmit={onSubmit} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-indigo-600 text-white">
          <h2 className="font-semibold">
            {mode === "edit" ? "Edit question" : "New question"}
            {dirty && <span className="ml-2 text-xs font-normal text-indigo-100">· unsaved changes</span>}
          </h2>
          <button type="button" onClick={() => guard(onClose)} aria-label="Close editor" className="p-1.5 rounded-lg hover:bg-white/15 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">{error}</p>
          )}

          <div>
            <label htmlFor="qb-text" className="block text-xs font-medium text-slate-400 mb-1">Question *</label>
            <textarea
              id="qb-text"
              required
              rows={3}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Enter the full question. Use $…$ for maths."
              className={`${field} resize-y font-mono`}
            />
            {form.text.includes("$") && (
              <div className="mt-1.5 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed">
                <MathText text={form.text} />
              </div>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-400 mb-1">Options — tick the correct answer *</legend>
            {form.options.map((opt, i) => (
              <div key={opt.label} className="space-y-1">
                <div className={`flex items-center gap-3 pl-3 pr-1.5 py-1.5 rounded-xl border transition-colors ${opt.isCorrect ? "border-emerald-500/60 bg-emerald-500/5" : "border-slate-700"}`}>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="radio"
                      name="qb-correct"
                      checked={opt.isCorrect}
                      onChange={() => setOption(i, { isCorrect: true })}
                      aria-label={`Option ${opt.label} is the correct answer`}
                      className="sr-only peer"
                    />
                    <span
                      aria-hidden="true"
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 ${
                        opt.isCorrect ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-600"
                      }`}
                    >
                      {opt.isCorrect && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      )}
                    </span>
                    <span className="w-4 text-xs font-bold text-slate-400">{opt.label}</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Option ${opt.label}`}
                    aria-label={`Option ${opt.label} text`}
                    value={opt.text}
                    onChange={(e) => setOption(i, { text: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1.5 bg-transparent text-slate-200 text-sm font-mono focus:outline-none"
                  />
                </div>
                {opt.text.includes("$") && (
                  <div className="ml-12 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <MathText text={opt.text} />
                  </div>
                )}
              </div>
            ))}
          </fieldset>

          <div>
            <label htmlFor="qb-explanation" className="block text-xs font-medium text-slate-400 mb-1">Explanation (optional)</label>
            <textarea
              id="qb-explanation"
              rows={2}
              value={form.explanation}
              onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              placeholder="Why is the correct answer correct?"
              className={`${field} resize-y font-mono`}
            />
            {form.explanation.includes("$") && (
              <div className="mt-1.5 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-indigo-100 text-sm">
                <MathText text={form.explanation} />
              </div>
            )}
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1">Image (optional)</span>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-slate-400 text-sm cursor-pointer hover:border-indigo-500/50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                {uploading ? "Uploading…" : form.imageUrl ? "Change image" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadImage(file, (url) => setForm((f) => ({ ...f, imageUrl: url })), setUploading);
                  }}
                />
              </label>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                  className="px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="Question image" className="mt-2 max-h-40 rounded-lg border border-slate-700 object-contain" />
            )}
          </div>
        </div>

        {/* ── Footer strip: where the question belongs ───────────────────── */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/40 flex flex-wrap items-center gap-2">
          {mode === "edit" ? (
            <span className={`${chip} !bg-slate-900`}>{subjectName}</span>
          ) : (
            <select
              required
              aria-label="Subject"
              value={form.subjectId}
              onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value, topicId: "" }))}
              className={chip}
            >
              <option value="">Subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select
            aria-label="Topic"
            value={form.topicId}
            onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}
            disabled={!form.subjectId || topicList.length === 0}
            className={`${chip} max-w-48`}
          >
            <option value="">No topic</option>
            {topicList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            required={mode === "create"}
            aria-label="Exam type"
            value={form.examType}
            onChange={(e) => setForm((f) => ({ ...f, examType: e.target.value, school: e.target.value !== "POST_UTME" ? "" : f.school }))}
            className={`${chip} !border-amber-500/40 !text-amber-300`}
          >
            <option value="">{mode === "create" ? "Exam type…" : "Exam type not set"}</option>
            <option value="JAMB">JAMB</option>
            <option value="POST_UTME">Post-UTME</option>
            <option value="WAEC">WAEC</option>
          </select>
          {form.examType === "POST_UTME" && (
            <select
              required={mode === "create"}
              aria-label="School"
              value={form.school}
              onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
              className={`${chip} max-w-48`}
            >
              <option value="">School…</option>
              {SCHOOLS.map((s) => <option key={s.id} value={s.id}>{s.abbr} — {s.name}</option>)}
            </select>
          )}
          <select
            aria-label="Difficulty"
            value={form.difficulty}
            onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
            className={`${chip} ${DIFFICULTY_TONE[form.difficulty] ?? ""}`}
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
          <input
            type="number"
            min={1978}
            max={2030}
            placeholder="Year"
            aria-label="Year"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            className={`${chip} w-24`}
          />

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => guard(onClose)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create question"}
            </button>
          </div>
        </div>
      </form>

      <ConfirmModal
        open={pending !== null}
        title="Discard your changes?"
        message="This question has edits that have not been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => { const action = pending; setPending(null); action?.(); }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
