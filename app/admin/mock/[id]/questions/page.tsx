"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

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
}

export default function QuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [jsonText, setJsonText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number } | null>(null);
  const [parseError, setParseError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    setLoading(true);
    apiClient<MockQuestion[]>(`/api/admin/mock/${id}/questions`)
      .then(setQuestions)
      .catch(() => setError("Failed to load questions"))
      .finally(() => setLoading(false));
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
        body: JSON.stringify({ questions: parsed }),
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
            Paste an array of question objects. Uploading again will <strong>replace</strong> all existing questions.
          </p>
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
          <p className="text-sm text-emerald-500">Uploaded {uploadResult.count} questions successfully!</p>
        )}
        <button type="submit" disabled={uploading} className="btn-primary disabled:opacity-60">
          {uploading ? "Uploading…" : "Upload & Replace Questions"}
        </button>
      </form>

      {/* Question list */}
      <div>
        <h3 className="font-semibold mb-3">Questions ({questions.length})</h3>
        {loading ? <Loader className="py-8" /> : questions.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-400 text-sm">No questions yet. Upload a JSON file above.</div>
        ) : (
          <div className="space-y-2">
            {questions.map((q, idx) => (
              <div key={q.id} className="glass-panel rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed line-clamp-2">{q.text}</span>
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
                        <span>{opt.text}</span>
                        {opt.isCorrect && <span className="ml-auto text-xs font-semibold shrink-0">Correct</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
