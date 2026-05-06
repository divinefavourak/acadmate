"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MathText from "@/app/components/MathText";
import { apiClient, ApiError } from "@/lib/api/client";
import MiniBarChart from "@/app/admin/components/MiniBarChart";
import Loader from "@/app/components/Loader";

interface QuestionEntry {
  id: string;
  text: string;
  difficulty: string;
  year: number | null;
  isPublished: boolean;
  isFlagged: boolean;
  flagCount: number;
  aiAssisted: boolean;
  sourceType: string;
  subject: { id: string; name: string };
  topic: { id: string; name: string } | null;
  _count: { options: number };
}

interface OptionEntry {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface FullQuestionEntry extends QuestionEntry {
  options: OptionEntry[];
  explanation: { id: string; text: string } | null;
  imageUrl: string | null;
}

interface SubjectOption {
  id: string;
  name: string;
  _count?: { questions: number };
}

interface TopicOption {
  id: string;
  name: string;
}

interface YearOption {
  year: number | null;
  count: number;
}

interface QuestionsResponse {
  questions: QuestionEntry[];
  total: number;
}

interface FlaggedQuestionsResponse {
  questions: QuestionEntry[];
}

const difficultyColors: Record<string, string> = {
  EASY: "text-emerald-400",
  MEDIUM: "text-amber-400",
  HARD: "text-red-400",
};

const OPTION_LABELS = ["A", "B", "C", "D"];

const emptyForm = {
  subjectId: "",
  topicId: "",
  text: "",
  imageUrl: "",
  year: "",
  difficulty: "MEDIUM",
  options: OPTION_LABELS.map((label) => ({ label, text: "", isCorrect: false })),
  explanation: "",
};

export default function QuestionsPageWrapper() {
  return (
    <Suspense>
      <QuestionsPage />
    </Suspense>
  );
}

function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [publishedFilter, setPublishedFilter] = useState<string>("");
  const [flaggedFilter, setFlaggedFilter] = useState(false);
  const limit = 20;

  const [showForm, setShowForm] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Navigation state
  const [activeSubject, setActiveSubject] = useState<SubjectOption | null>(null);
  const [activeYear, setActiveYear] = useState<number | "unknown" | null>(null);
  const [years, setYears] = useState<YearOption[]>([]);

  const [formError, setFormError] = useState("");

  const [previewQuestion, setPreviewQuestion] = useState<FullQuestionEntry | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editQuestion, setEditQuestion] = useState<FullQuestionEntry | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [activeTab, setActiveTab] = useState<"questions" | "flagged" | "analytics">("questions");
  const [flaggedQuestions, setFlaggedQuestions] = useState<QuestionEntry[]>([]);
  const [loadingFlagged, setLoadingFlagged] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{ subject: string; questions: number; flagged: number }[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // If a highlight param is present (from notification click), open flagged tab
  useEffect(() => {
    if (highlightId) setActiveTab("flagged");
  }, [highlightId]);

  // Scroll to highlighted question once flagged tab is loaded
  useEffect(() => {
    if (highlightId && activeTab === "flagged" && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, activeTab, flaggedQuestions]);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [editUploadingImage, setEditUploadingImage] = useState(false);

  async function handleImageUpload(
    file: File,
    setter: (url: string) => void,
    setUploading: (v: boolean) => void
  ) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const data = await apiClient<{ url: string }>("/upload", { method: "POST", body: fd });
      setter(data.url);
    } catch { /* upload failed silently */ } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    apiClient<{ subjects: { id: string; name: string; code: string }[] }>("/admin/subjects")
      .then((data) => setSubjects(data.subjects ?? [])).catch(() => {});
    apiClient<FlaggedQuestionsResponse>("/admin/questions?flagged=true&limit=500")
      .then((data) => setFlaggedQuestions(data.questions ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeSubject) return;
    apiClient<{ years: YearOption[] }>(`/admin/subjects/${activeSubject.id}/years`)
      .then((data) => setYears(data.years ?? [])).catch(() => {});
  }, [activeSubject]);

  useEffect(() => {
    if (!activeSubject || activeYear === null) {
      setQuestions([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
      subjectId: activeSubject.id,
    });
    if (activeYear !== "unknown") params.set("year", String(activeYear));
    if (publishedFilter !== "") params.set("isPublished", publishedFilter);
    if (flaggedFilter) params.set("flagged", "true");

    apiClient<QuestionsResponse>(`/admin/questions?${params}`)
      .then((data) => {
        setQuestions(data.questions ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, publishedFilter, flaggedFilter, activeSubject, activeYear]);

  useEffect(() => {
    if (!form.subjectId) { setTopics([]); return; }
    apiClient<{ topics: { id: string; name: string }[] }>(`/topics?subjectId=${form.subjectId}`)
      .then((data) => setTopics(data.topics ?? [])).catch(() => {});
  }, [form.subjectId]);

  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    if (activeTab !== "flagged") return;
    setLoadingFlagged(true);
    apiClient<FlaggedQuestionsResponse>("/admin/questions?flagged=true&limit=500")
      .then((data) => setFlaggedQuestions(data.questions ?? []))
      .catch(() => {})
      .finally(() => setLoadingFlagged(false));
  }, [activeTab]);

  // Analytics data is derived from already-loaded subjects + flaggedQuestions — no extra fetches needed
  useEffect(() => {
    if (subjects.length === 0) return;
    const flaggedCount: Record<string, number> = {};
    for (const q of flaggedQuestions) {
      flaggedCount[q.subject.name] = (flaggedCount[q.subject.name] ?? 0) + 1;
    }
    setAnalyticsData(
      subjects.map((s) => ({
        subject: s.name,
        questions: s._count?.questions ?? 0,
        flagged: flaggedCount[s.name] ?? 0,
      }))
    );
    setLoadingAnalytics(false);
  }, [subjects, flaggedQuestions]);

  // grouped flagged questions by subject
  const flaggedBySubject = flaggedQuestions.reduce<Record<string, QuestionEntry[]>>((acc, q) => {
    const key = q.subject.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  async function togglePublish(id: string, current: boolean) {
    await fetch(`/api/admin/questions/${id}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !current }),
    });
    setQuestions((prev) =>
      prev.map((q) => q.id === id ? { ...q, isPublished: !current } : q)
    );
  }

  async function handlePreview(id: string) {
    setLoadingPreview(id);
    try {
      const res = await fetch(`/api/admin/questions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewQuestion(data.question);
      }
    } finally {
      setLoadingPreview(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/questions/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== deleteId));
        setTotal((prev) => prev - 1);
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  function setOption(idx: number, field: "text" | "isCorrect", value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => {
        if (field === "isCorrect") {
          return { ...opt, isCorrect: i === idx };
        }
        return i === idx ? { ...opt, text: value as string } : opt;
      }),
    }));
  }

  async function handleOpenEdit(id: string) {
    setLoadingEdit(id);
    try {
      const res = await fetch(`/api/admin/questions/${id}`);
      if (res.ok) {
        const data = await res.json();
        const q: FullQuestionEntry = data.question;
        setEditQuestion(q);
        setEditForm({
          subjectId: q.subject.id,
          topicId: q.topic?.id ?? "",
          text: q.text,
          imageUrl: q.imageUrl ?? "",
          year: q.year ? String(q.year) : "",
          difficulty: q.difficulty,
          options: OPTION_LABELS.map((label) => {
            const opt = q.options.find((o) => o.label === label);
            return { label, text: opt?.text ?? "", isCorrect: opt?.isCorrect ?? false };
          }),
          explanation: q.explanation?.text ?? "",
        });
        setEditError("");
      }
    } finally {
      setLoadingEdit(null);
    }
  }

  async function handleClearFlag(id: string) {
    await fetch(`/api/admin/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFlagged: false }),
    });
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, isFlagged: false, flagCount: 0 } : q));
    setFlaggedQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editQuestion) return;
    setEditError("");

    const correctCount = editForm.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) { setEditError("Select exactly one correct answer."); return; }
    if (editForm.options.some((o) => !o.text.trim())) { setEditError("All option texts are required."); return; }

    setEditSaving(true);
    const payload: Record<string, unknown> = {
      text: editForm.text.trim(),
      difficulty: editForm.difficulty,
      options: editForm.options.map((o, i) => ({ label: o.label, text: o.text.trim(), isCorrect: o.isCorrect, sortOrder: i })),
    };
    if (editForm.topicId) payload.topicId = editForm.topicId;
    if (editForm.year) payload.year = Number(editForm.year);
    payload.imageUrl = editForm.imageUrl || "";
    if (editForm.explanation.trim()) payload.explanation = editForm.explanation.trim();

    const res = await fetch(`/api/admin/questions/${editQuestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setEditError(d.error ?? "Failed to save.");
      return;
    }
    setEditQuestion(null);
    // Refresh list
    setPage(0);
  }

  function setEditOption(idx: number, field: "text" | "isCorrect", value: string | boolean) {
    setEditForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => {
        if (field === "isCorrect") return { ...opt, isCorrect: i === idx };
        return i === idx ? { ...opt, text: value as string } : opt;
      }),
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const correctCount = form.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      setFormError("Please select exactly one correct answer.");
      return;
    }
    if (form.options.some((o) => !o.text.trim())) {
      setFormError("All four option texts are required.");
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      subjectId: form.subjectId,
      text: form.text.trim(),
      difficulty: form.difficulty,
      options: form.options.map((o, i) => ({
        label: o.label,
        text: o.text.trim(),
        isCorrect: o.isCorrect,
        sortOrder: i,
      })),
      sourceType: "MANUAL",
    };
    if (form.topicId) payload.topicId = form.topicId;
    if (form.year) payload.year = Number(form.year);
    if (form.imageUrl) payload.imageUrl = form.imageUrl;
    if (form.explanation.trim()) payload.explanation = form.explanation.trim();

    try {
      await apiClient("/admin/questions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setForm(emptyForm);
      setTopics([]);
      setPage(0);
      const params = new URLSearchParams({ limit: String(limit), offset: "0" });
      if (publishedFilter !== "") params.set("isPublished", publishedFilter);
      setLoading(true);
      apiClient<QuestionsResponse>(`/admin/questions?${params}`)
        .then((d) => { setQuestions(d.questions ?? []); setTotal(d.total ?? 0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Failed to create question.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Questions</h1>
          {activeTab === "questions" && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => { setActiveSubject(null); setActiveYear(null); }}
                className={`hover:text-white transition-colors ${!activeSubject ? "text-white font-medium" : "text-slate-400"}`}
              >
                Subjects
              </button>
              {activeSubject && (
                <>
                  <span className="text-slate-600">/</span>
                  <button
                    onClick={() => setActiveYear(null)}
                    className={`hover:text-white transition-colors ${activeYear === null ? "text-white font-medium" : "text-slate-400"}`}
                  >
                    {activeSubject.name}
                  </button>
                </>
              )}
              {activeYear !== null && (
                <>
                  <span className="text-slate-600">/</span>
                  <span className="text-white font-medium">
                    {activeYear === "unknown" ? "No Year" : activeYear}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "questions" && activeSubject && activeYear !== null && (
            <select
              value={publishedFilter}
              onChange={(e) => { setPublishedFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="">All Questions</option>
              <option value="true">Published</option>
              <option value="false">Unpublished</option>
            </select>
          )}
          {activeTab === "questions" && (
            <button
              onClick={() => {
                const nextState = !showForm;
                setShowForm(!showForm);
                setFormError("");
                if (nextState && activeSubject) {
                  setForm(f => ({ ...f, subjectId: activeSubject.id, year: activeYear !== "unknown" && activeYear !== null ? String(activeYear) : "" }));
                }
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              {showForm ? "Cancel" : "+ New Question"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl w-fit">
        {(["questions", "flagged", "analytics"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setShowForm(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === t
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "flagged" ? (
              <span className="flex items-center gap-1.5">
                🚩 Flagged
                {flaggedQuestions.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-400 text-xs">{flaggedQuestions.length}</span>
                )}
              </span>
            ) : t === "questions" ? "Questions" : "Analytics"}
          </button>
        ))}
      </div>

      {/* ── Questions tab ─────────────────────────────────── */}
      {activeTab === "questions" && showForm ? (
        <form onSubmit={handleCreate} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5">

          <h2 className="text-lg font-bold text-white">Create Question</h2>

          {formError && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Subject *</label>
              <select
                required
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value, topicId: "" }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Topic</label>
              <select
                value={form.topicId}
                onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}
                disabled={!form.subjectId || topics.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-40"
              >
                <option value="">No topic (optional)</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty *</label>
              <select
                required
                value={form.difficulty}
                onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Year</label>
              <input
                type="number"
                min={1990}
                max={2030}
                placeholder="e.g. 2023"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Question Text *</label>
            <textarea
              required
              rows={3}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Enter the full question text…"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-400">Options — select the correct answer *</p>
            {form.options.map((opt, i) => (
              <div key={opt.label} className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={opt.isCorrect}
                    onChange={() => setOption(i, "isCorrect", true)}
                    className="accent-indigo-500"
                  />
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${opt.isCorrect ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300"}`}>
                    {opt.label}
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Option ${opt.label}`}
                  value={opt.text}
                  onChange={(e) => setOption(i, "text", e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Explanation (optional)</label>
            <textarea
              rows={2}
              value={form.explanation}
              onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              placeholder="Why is the correct answer correct?"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Image (optional)</label>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 text-sm cursor-pointer hover:border-indigo-500/50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                {uploadingImage ? "Uploading…" : form.imageUrl ? "Change image" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, (url) => setForm((f) => ({ ...f, imageUrl: url })), setUploadingImage);
                  }}
                />
              </label>
              {form.imageUrl && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                  className="px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 transition-colors">
                  Remove
                </button>
              )}
            </div>
            {form.imageUrl && (
              <img src={form.imageUrl} alt="Question image" className="mt-2 max-h-40 rounded-lg border border-slate-700 object-contain" />
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Create Question"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyForm); setFormError(""); }}
              className="px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : !activeSubject ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjects.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setActiveSubject(sub)}
              className="flex flex-col items-start p-5 rounded-2xl bg-slate-800 border border-slate-700 hover:border-indigo-500/50 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="text-indigo-400">📁</span>
              </div>
              <h3 className="text-white font-bold mb-1">{sub.name}</h3>
              <p className="text-slate-400 text-xs">
                {sub._count?.questions ? `${sub._count.questions} questions` : "0 questions"}
              </p>
            </button>
          ))}
        </div>
      ) : activeYear === null ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center min-h-75">
          <h2 className="text-lg font-medium text-white mb-6">Select a Year for {activeSubject.name}</h2>
          {years.length === 0 ? (
            <p className="text-slate-400 text-sm">No questions available for this subject.</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3 max-w-2xl">
              {years.map((y) => (
                <button
                  key={y.year ?? "unknown"}
                  onClick={() => { setActiveYear(y.year ?? "unknown"); setPage(0); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
                >
                  <span className="font-medium text-sm">{y.year ?? "No Year"}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900/50 text-slate-400 text-xs">
                    {y.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          {loading ? (
            <Loader />
          ) : questions.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">No questions found.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-800">
                {questions.map((q) => (
                  <div key={q.id} className="py-3 space-y-2">
                    <p className="text-white text-sm line-clamp-2">{q.text}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={`font-medium ${difficultyColors[q.difficulty] ?? "text-slate-400"}`}>{q.difficulty}</span>
                      <span className="text-slate-500">{q.year ?? "No year"}</span>
                      {q.isFlagged && <span className="text-red-400">🚩{q.flagCount}</span>}
                      <button onClick={() => togglePublish(q.id, q.isPublished)}
                        className={`px-2 py-0.5 rounded-full font-medium ${q.isPublished ? "bg-emerald-900/30 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                        {q.isPublished ? "Published" : "Draft"}
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleOpenEdit(q.id)} disabled={loadingEdit === q.id}
                        className="px-2.5 py-1 rounded bg-indigo-900/30 text-indigo-400 text-xs font-medium disabled:opacity-50">
                        {loadingEdit === q.id ? "…" : "Edit"}
                      </button>
                      <button onClick={() => handlePreview(q.id)} disabled={loadingPreview === q.id}
                        className="px-2.5 py-1 rounded bg-slate-700 text-slate-300 text-xs font-medium disabled:opacity-50">
                        {loadingPreview === q.id ? "…" : "Preview"}
                      </button>
                      {q.isFlagged && (
                        <button onClick={() => handleClearFlag(q.id)}
                          className="px-2.5 py-1 rounded bg-amber-900/30 text-amber-400 text-xs font-medium">Unflag</button>
                      )}
                      <button onClick={() => setDeleteId(q.id)}
                        className="px-2.5 py-1 rounded bg-red-900/30 text-red-400 text-xs font-medium">Del</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="pb-3 font-medium">Question</th>
                      <th className="pb-3 font-medium">Topic</th>
                      <th className="pb-3 font-medium">Difficulty</th>
                      <th className="pb-3 font-medium">Year</th>
                      <th className="pb-3 font-medium text-right">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, i) => (
                      <tr key={q.id}
                        className={`${i < questions.length - 1 ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}>
                        <td className="py-3 text-white max-w-xs"><p className="truncate">{q.text}</p></td>
                        <td className="py-3 text-slate-500">{q.topic ? q.topic.name : "—"}</td>
                        <td className={`py-3 font-medium ${difficultyColors[q.difficulty] ?? "text-slate-400"}`}>{q.difficulty}</td>
                        <td className="py-3 text-slate-400">{q.year ?? "—"}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {q.isFlagged && <span title={`Flagged ${q.flagCount}x`} className="text-xs text-red-400 mr-1">🚩{q.flagCount > 1 ? q.flagCount : ""}</span>}
                            <button onClick={() => togglePublish(q.id, q.isPublished)}
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${q.isPublished ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}>
                              {q.isPublished ? "Published" : "Unpublished"}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleOpenEdit(q.id)} disabled={loadingEdit === q.id}
                              className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 text-xs font-medium transition-colors disabled:opacity-50">
                              {loadingEdit === q.id ? "…" : "Edit"}
                            </button>
                            <button onClick={() => handlePreview(q.id)} disabled={loadingPreview === q.id}
                              className="inline-flex items-center px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50">
                              {loadingPreview === q.id ? "..." : "Preview"}
                            </button>
                            {q.isFlagged && (
                              <button onClick={() => handleClearFlag(q.id)}
                                className="inline-flex items-center px-2.5 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 text-xs font-medium transition-colors">Unflag</button>
                            )}
                            <button onClick={() => setDeleteId(q.id)}
                              className="inline-flex items-center px-2.5 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 text-xs font-medium transition-colors">Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
  
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total} questions
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 0}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Flagged tab ────────────────────────────────────── */}
      {activeTab === "flagged" && (
        <div className="space-y-6">
          {loadingFlagged ? (
            <Loader />
          ) : flaggedQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <span className="text-3xl">🎉</span>
              <p className="text-sm">No flagged questions</p>
            </div>
          ) : (
            Object.entries(flaggedBySubject).map(([subjectName, qs]) => (
              <div key={subjectName} className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="font-semibold text-white">{subjectName}</h3>
                  <span className="text-xs text-red-400 bg-red-900/20 px-2 py-0.5 rounded-full">{qs.length} flagged</span>
                </div>
                <div className="divide-y divide-slate-800">
                  {qs.map((q) => (
                    <div
                      key={q.id}
                      ref={highlightId === q.id ? highlightRef : null}
                      className={`px-5 py-3 flex items-start gap-4 transition-colors ${
                        highlightId === q.id ? "bg-indigo-900/30 ring-1 ring-indigo-500/50" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{q.text}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500">{q.year ?? "No year"}</span>
                          <span className={`text-xs font-medium ${difficultyColors[q.difficulty] ?? "text-slate-400"}`}>{q.difficulty}</span>
                          <span className="text-xs text-red-400">🚩 {q.flagCount}×</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(q.id)}
                          disabled={loadingEdit === q.id}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {loadingEdit === q.id ? "…" : "Edit"}
                        </button>
                        <button
                          onClick={() => handlePreview(q.id)}
                          disabled={loadingPreview === q.id}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {loadingPreview === q.id ? "…" : "Preview"}
                        </button>
                        <button
                          onClick={() => handleClearFlag(q.id)}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-amber-900/30 text-amber-400 hover:bg-amber-900/50 text-xs font-medium transition-colors"
                        >
                          Unflag
                        </button>
                        <button
                          onClick={() => setDeleteId(q.id)}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 text-xs font-medium transition-colors"
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Analytics tab ──────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <Loader />
          ) : (
            <>
              <div className="glass-panel border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                <h2 className="text-lg font-bold mb-1">Questions per Subject</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Total questions in the question bank</p>
                <MiniBarChart
                  data={analyticsData.map((d) => ({ label: d.subject, count: d.questions }))}
                  valueKey="count"
                  color="indigo"
                  emptyMessage="No data"
                />
              </div>
              <div className="glass-panel border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
                <h2 className="text-lg font-bold mb-1">Flagged per Subject</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Questions currently flagged by students</p>
                <MiniBarChart
                  data={analyticsData.map((d) => ({ label: d.subject, count: d.flagged }))}
                  valueKey="count"
                  color="amber"
                  emptyMessage="No flagged questions"
                />
              </div>
              <div className="overflow-x-auto bg-slate-800/50 border border-slate-700 rounded-2xl">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="px-5 py-3 font-medium">Subject</th>
                      <th className="px-5 py-3 font-medium text-right">Total</th>
                      <th className="px-5 py-3 font-medium text-right">Flagged</th>
                      <th className="px-5 py-3 font-medium text-right">Flag rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.map((d, i) => (
                      <tr key={d.subject} className={i < analyticsData.length - 1 ? "border-b border-slate-800" : ""}>
                        <td className="px-5 py-3 text-white font-medium">{d.subject}</td>
                        <td className="px-5 py-3 text-slate-300 text-right">{d.questions.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={d.flagged > 0 ? "text-red-400" : "text-slate-500"}>{d.flagged}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-right text-xs">
                          {d.questions > 0 ? `${((d.flagged / d.questions) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">Edit Question</h3>
              <button onClick={() => setEditQuestion(null)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 overflow-y-auto space-y-4">
              {editError && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">{editError}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty</label>
                  <select value={editForm.difficulty} onChange={(e) => setEditForm((f) => ({ ...f, difficulty: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Year</label>
                  <input type="number" min={1978} max={2030} placeholder="e.g. 2023" value={editForm.year}
                    onChange={(e) => setEditForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Question Text *</label>
                <textarea required rows={3} value={editForm.text} onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono" />
                {editForm.text.trim() && (
                  <div className="mt-1.5 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed">
                    <MathText text={editForm.text} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400">Options — select correct answer *</p>
                {editForm.options.map((opt, i) => (
                  <div key={opt.label} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer shrink-0">
                        <input type="radio" name="editCorrect" checked={opt.isCorrect} onChange={() => setEditOption(i, "isCorrect", true)} className="accent-indigo-500" />
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${opt.isCorrect ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300"}`}>{opt.label}</span>
                      </label>
                      <input type="text" required placeholder={`Option ${opt.label}`} value={opt.text}
                        onChange={(e) => setEditOption(i, "text", e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono" />
                    </div>
                    {opt.text.includes("$") && (
                      <div className="ml-10 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300">
                        <MathText text={opt.text} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Explanation</label>
                <textarea rows={2} value={editForm.explanation} onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))}
                  placeholder="Why is the correct answer correct?"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono" />
                {editForm.explanation.includes("$") && (
                  <div className="mt-1.5 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-indigo-100 text-sm">
                    <MathText text={editForm.explanation} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Image (optional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-sm cursor-pointer hover:border-indigo-500/50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    {editUploadingImage ? "Uploading…" : editForm.imageUrl ? "Change image" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={editUploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, (url) => setEditForm((f) => ({ ...f, imageUrl: url })), setEditUploadingImage);
                      }}
                    />
                  </label>
                  {editForm.imageUrl && (
                    <button type="button" onClick={() => setEditForm((f) => ({ ...f, imageUrl: "" }))}
                      className="px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 transition-colors">
                      Remove
                    </button>
                  )}
                </div>
                {editForm.imageUrl && (
                  <img src={editForm.imageUrl} alt="Question image" className="mt-2 max-h-40 rounded-lg border border-slate-700 object-contain" />
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={editSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60">
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditQuestion(null)}
                  className="px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-slate-700 flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Question Preview</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">{previewQuestion.subject.name}</span>
                  {previewQuestion.topic && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">{previewQuestion.topic.name}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded bg-slate-800 ${difficultyColors[previewQuestion.difficulty]}`}>
                    {previewQuestion.difficulty}
                  </span>
                  {previewQuestion.year && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">{previewQuestion.year}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto space-y-6">
              <div className="text-white text-lg leading-relaxed">
                <MathText text={previewQuestion.text} />
              </div>
              {previewQuestion.imageUrl && (
                <img src={previewQuestion.imageUrl} alt="Question image" className="rounded-xl border border-slate-700 max-h-64 object-contain" />
              )}

              <div className="space-y-3">
                {previewQuestion.options.map((opt) => (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      opt.isCorrect
                        ? "bg-emerald-900/20 border-emerald-800/50"
                        : "bg-slate-800/50 border-slate-700"
                    }`}
                  >
                    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                      opt.isCorrect ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"
                    }`}>
                      {opt.label}
                    </span>
                    <span className={`text-sm flex-1 ${opt.isCorrect ? "text-emerald-50" : "text-slate-300"}`}>
                      <MathText text={opt.text} />
                    </span>
                    {opt.isCorrect && (
                      <span className="shrink-0 text-emerald-400 text-xs font-bold uppercase tracking-wider bg-emerald-900/50 px-2 py-1 rounded">
                        Correct Answer
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {previewQuestion.explanation && (
                <div className="p-4 rounded-xl bg-indigo-900/20 border border-indigo-800/30 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Explanation</h4>
                  <p className="text-sm text-indigo-100">
                    <MathText text={previewQuestion.explanation.text} />
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-6 flex flex-col">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center shrink-0">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Question</h3>
              <p className="text-slate-400 text-sm">
                Are you sure you want to delete this question? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
