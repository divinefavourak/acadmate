"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";
import MathText from "@/app/components/MathText";
import ConfirmModal from "@/app/components/ConfirmModal";

interface QuestionOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

interface MockQuestion {
  id: string;
  text: string;
  sortOrder: number;
  options: QuestionOption[];
  subject: string | null;
  explanation?: string | null;
  imageUrl?: string | null;
}

export default function QuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [jsonText, setJsonText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number } | null>(null);
  const [uploadMode, setUploadMode] = useState<"replace" | "append">("replace");
  const [parseError, setParseError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const UNCATEGORISED = "Uncategorised";

  // Distinct subjects with their question counts, sorted alphabetically.
  const subjectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      const key = q.subject?.trim() || UNCATEGORISED;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [questions]);

  const visibleQuestions = useMemo(() => {
    if (subjectFilter === "all") return questions;
    return questions.filter((q) => (q.subject?.trim() || UNCATEGORISED) === subjectFilter);
  }, [questions, subjectFilter]);

  useEffect(() => {
    load();
  }, [id]);

  // If the active filter disappears after a re-upload, fall back to "all".
  useEffect(() => {
    if (subjectFilter !== "all" && !subjectCounts.some(([s]) => s === subjectFilter)) {
      setSubjectFilter("all");
    }
  }, [subjectCounts, subjectFilter]);

  function load() {
    setLoading(true);
    apiClient<MockQuestion[]>(`/api/admin/mock/${id}/questions`)
      .then(setQuestions)
      .catch(() => setError("Failed to load questions"))
      .finally(() => setLoading(false));
  }

  async function handleDeleteQuestion() {
    if (!deletingId) return;
    setDeleteLoading(true);
    setError("");
    try {
      await apiClient(`/api/admin/mock/${id}/questions/${deletingId}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== deletingId));
      setDeletingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete question");
      setDeletingId(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  // Download all uploaded questions as one JSON file, in the same shape the
  // upload box accepts (so an export can be re-uploaded or fed to the offline
  // xlsx generator). Purely client-side — the full list is already loaded.
  function handleExport() {
    if (questions.length === 0) return;
    const payload = [...questions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((q) => ({
        text: q.text,
        subject: q.subject,
        options: q.options.map(({ label, text, isCorrect }) => ({ label, text, isCorrect })),
        ...(q.explanation ? { explanation: q.explanation } : {}),
        ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}),
      }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mock-${id}-questions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setParseError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setParseError("Invalid JSON — check your format and try again.");
      return;
    }
    setUploading(true);
    setError("");
    setUploadResult(null);
    try {
      const res = await apiClient<{ count: number }>(`/api/admin/mock/${id}/questions/upload`, {
        method: "POST",
        body: JSON.stringify({ questions: parsed, mode: uploadMode }),
      });
      setUploadResult(res);
      setJsonText("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const SAMPLE = JSON.stringify(
    [
      {
        text: "Which of the following is NOT a programming paradigm?",
        subject: "Computer Science",
        options: [
          { label: "A", text: "Object-Oriented", isCorrect: false },
          { label: "B", text: "Functional", isCorrect: false },
          { label: "C", text: "Declarative", isCorrect: false },
          { label: "D", text: "Sequential", isCorrect: true },
        ],
      },
    ],
    null,
    2
  );

  return (
    <div className="space-y-6">
      {/* Upload panel */}
      <form onSubmit={handleUpload} className="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h3 className="font-semibold">Upload Questions (JSON)</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Paste an array of question objects, then choose whether to add them to the existing set or replace everything.
          </p>
        </div>

        {/* Replace vs. append */}
        <div className="flex flex-col sm:flex-row gap-2">
          <label className={`flex-1 flex items-start gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
            uploadMode === "append"
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
          }`}>
            <input type="radio" name="uploadMode" className="mt-0.5 accent-indigo-600" checked={uploadMode === "append"} onChange={() => setUploadMode("append")} />
            <span className="text-xs">
              <span className="font-semibold block">Add to existing</span>
              <span className="text-slate-400">Append these to the current questions. Build a paper across several uploads.</span>
            </span>
          </label>
          <label className={`flex-1 flex items-start gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
            uploadMode === "replace"
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
          }`}>
            <input type="radio" name="uploadMode" className="mt-0.5 accent-indigo-600" checked={uploadMode === "replace"} onChange={() => setUploadMode("replace")} />
            <span className="text-xs">
              <span className="font-semibold block">Replace all</span>
              <span className="text-slate-400">Delete every existing question first, then upload these.</span>
            </span>
          </label>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-indigo-500 font-medium">Show expected format</summary>
          <pre className="mt-2 bg-slate-100 dark:bg-slate-900 rounded-xl p-3 overflow-x-auto text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            {SAMPLE}
          </pre>
        </details>
        <textarea
          required
          rows={10}
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setParseError(""); }}
          placeholder='[{"text": "...", "options": [...]}]'
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-y"
        />
        {parseError && <p className="text-sm text-red-500">{parseError}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {uploadResult && (
          <p className="text-sm text-emerald-500">
            {uploadMode === "append" ? "Added" : "Uploaded"} {uploadResult.count} question{uploadResult.count !== 1 ? "s" : ""} successfully!
          </p>
        )}
        <button type="submit" disabled={uploading} className="btn-primary disabled:opacity-60">
          {uploading ? "Uploading…" : uploadMode === "append" ? "Upload & Add Questions" : "Upload & Replace Questions"}
        </button>
      </form>

      {/* Question list */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold">
            Questions ({visibleQuestions.length}{subjectFilter !== "all" ? ` of ${questions.length}` : ""})
          </h3>
          <button
            onClick={handleExport}
            disabled={questions.length === 0}
            title="Download all uploaded questions as a JSON file"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export JSON
          </button>
        </div>

        {/* Subject filter */}
        {subjectCounts.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSubjectFilter("all")}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                subjectFilter === "all"
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              All ({questions.length})
            </button>
            {subjectCounts.map(([subject, count]) => (
              <button
                key={subject}
                onClick={() => setSubjectFilter(subject)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  subjectFilter === subject
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {subject} ({count})
              </button>
            ))}
          </div>
        )}

        {loading ? <Loader className="py-8" /> : questions.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-400 text-sm">No questions yet. Upload a JSON file above.</div>
        ) : (
          <div className="space-y-2">
            {visibleQuestions.map((q, idx) => (
              <div key={q.id} className="glass-panel rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <MathText text={q.text} className="flex-1 text-sm leading-relaxed line-clamp-2" />
                  {q.subject && (
                    <span className="shrink-0 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{q.subject}</span>
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 transition-transform mt-0.5 ${expanded === q.id ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {expanded === q.id && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    {q.options.map((opt) => (
                      <div key={opt.label} className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${opt.isCorrect ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"}`}>
                        <span className="font-bold shrink-0 w-5">{opt.label}.</span>
                        <MathText text={opt.text} />
                        {opt.isCorrect && <span className="ml-auto text-xs font-semibold shrink-0">Correct</span>}
                      </div>
                    ))}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setDeletingId(q.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
                      >
                        Delete question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={deletingId !== null}
        title="Delete question"
        message="Delete this question permanently? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteQuestion}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
