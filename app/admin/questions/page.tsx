"use client";

import { useEffect, useState } from "react";

interface QuestionEntry {
  id: string;
  text: string;
  difficulty: string;
  year: number | null;
  isPublished: boolean;
  aiAssisted: boolean;
  sourceType: string;
  subject: { id: string; name: string };
  topic: { id: string; name: string } | null;
  _count: { options: number };
}

interface SubjectOption {
  id: string;
  name: string;
}

interface TopicOption {
  id: string;
  name: string;
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
  year: "",
  difficulty: "MEDIUM",
  options: OPTION_LABELS.map((label) => ({ label, text: "", isCorrect: false })),
  explanation: "",
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [publishedFilter, setPublishedFilter] = useState<string>("");
  const limit = 20;

  const [showForm, setShowForm] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (publishedFilter !== "") params.set("isPublished", publishedFilter);

    fetch(`/api/admin/questions?${params}`)
      .then((r) => r.ok ? r.json() : { questions: [], total: 0 })
      .then((data) => {
        setQuestions(data.questions ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, publishedFilter]);

  useEffect(() => {
    if (!showForm) return;
    fetch("/api/admin/subjects")
      .then((r) => r.ok ? r.json() : { subjects: [] })
      .then((data) => setSubjects(data.subjects ?? []));
  }, [showForm]);

  useEffect(() => {
    if (!form.subjectId) { setTopics([]); return; }
    fetch(`/api/topics?subjectId=${form.subjectId}`)
      .then((r) => r.ok ? r.json() : { topics: [] })
      .then((data) => setTopics(data.topics ?? []));
  }, [form.subjectId]);

  const totalPages = Math.ceil(total / limit);

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
    if (form.explanation.trim()) payload.explanation = form.explanation.trim();

    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFormError(data.error ?? "Failed to create question.");
      return;
    }

    setShowForm(false);
    setForm(emptyForm);
    setTopics([]);
    setPage(0);
    // Reload list
    const params = new URLSearchParams({ limit: String(limit), offset: "0" });
    if (publishedFilter !== "") params.set("isPublished", publishedFilter);
    setLoading(true);
    fetch(`/api/admin/questions?${params}`)
      .then((r) => r.ok ? r.json() : { questions: [], total: 0 })
      .then((d) => { setQuestions(d.questions ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Questions</h1>
          <p className="text-slate-400">Manage the question bank.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={publishedFilter}
            onChange={(e) => { setPublishedFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="">All Questions</option>
            <option value="true">Published</option>
            <option value="false">Unpublished</option>
          </select>
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            {showForm ? "Cancel" : "+ New Question"}
          </button>
        </div>
      </div>

      {showForm && (
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
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        {loading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No questions found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-3 font-medium">Question</th>
                    <th className="pb-3 font-medium">Subject</th>
                    <th className="pb-3 font-medium">Difficulty</th>
                    <th className="pb-3 font-medium">Year</th>
                    <th className="pb-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr
                      key={q.id}
                      className={`${i < questions.length - 1 ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}
                    >
                      <td className="py-3 text-white max-w-xs">
                        <p className="truncate">{q.text}</p>
                        {q.topic && <p className="text-xs text-slate-500 mt-0.5">{q.topic.name}</p>}
                      </td>
                      <td className="py-3 text-slate-300">{q.subject.name}</td>
                      <td className={`py-3 font-medium ${difficultyColors[q.difficulty] ?? "text-slate-400"}`}>
                        {q.difficulty}
                      </td>
                      <td className="py-3 text-slate-400">{q.year ?? "—"}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => togglePublish(q.id, q.isPublished)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            q.isPublished
                              ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                              : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                          }`}
                        >
                          {q.isPublished ? "Published" : "Unpublished"}
                        </button>
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
    </div>
  );
}
