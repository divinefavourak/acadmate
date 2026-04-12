"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  totalQuestions: number;
  subjects: { questionCount: number; subject: { id: string; name: string } }[];
}

interface Subject {
  id: string;
  name: string;
  code: string;
  _count: { questions: number };
}

interface Topic {
  id: string;
  name: string;
  _count: { questions: number };
}

type Mode = "MOCK" | "PRACTICE" | "TOPIC";

export default function NewExamPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [mode, setMode] = useState<Mode>("MOCK");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [questionCount, setQuestionCount] = useState(40);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/exams/templates").then((r) => r.ok ? r.json() : { templates: [] }),
      fetch("/api/subjects").then((r) => r.ok ? r.json() : { subjects: [] }),
    ]).then(([tData, sData]) => {
      const tmplList: Template[] = tData.templates ?? [];
      const subjList: Subject[] = sData.subjects ?? [];
      setTemplates(tmplList);
      setSubjects(subjList);
      if (tmplList.length > 0) setSelectedTemplate(tmplList[0].id);
      if (subjList.length > 0) setSelectedSubject(subjList[0].id);
    }).finally(() => setLoadingData(false));
  }, []);

  // Fetch topics when subject changes (for TOPIC mode)
  useEffect(() => {
    if (mode !== "TOPIC" || !selectedSubject) return;
    setLoadingTopics(true);
    setSelectedTopic("");
    fetch(`/api/topics?subjectId=${selectedSubject}`)
      .then((r) => r.ok ? r.json() : { topics: [] })
      .then((data) => {
        const list: Topic[] = data.topics ?? [];
        setTopics(list);
        if (list.length > 0) setSelectedTopic(list[0].id);
      })
      .finally(() => setLoadingTopics(false));
  }, [mode, selectedSubject]);

  async function handleStart() {
    setError("");

    if (mode === "MOCK" && !selectedTemplate) {
      setError("Please select an exam template.");
      return;
    }
    if ((mode === "PRACTICE") && !selectedSubject) {
      setError("Please select a subject.");
      return;
    }
    if (mode === "TOPIC" && !selectedTopic) {
      setError("Please select a topic.");
      return;
    }

    setStarting(true);

    const body =
      mode === "MOCK"
        ? { mode: "MOCK", examTemplateId: selectedTemplate }
        : mode === "TOPIC"
        ? { mode: "TOPIC", subjectId: selectedSubject, topicId: selectedTopic, questionCount }
        : { mode: "PRACTICE", subjectId: selectedSubject, questionCount };

    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to start exam. Please try again.");
      setStarting(false);
      return;
    }

    router.push(`/exam/${data.examSession.id}`);
  }

  const activeTemplate = templates.find((t) => t.id === selectedTemplate);

  const modeCards: { id: Mode; title: string; description: string }[] = [
    { id: "MOCK", title: "Full UTME Mock", description: "Timed exam across all 4 subjects, just like the real UTME." },
    { id: "PRACTICE", title: "Subject Practice", description: "Focus on a single subject at your own pace." },
    { id: "TOPIC", title: "Topic Drill", description: "Deep-dive into a specific topic within a subject." },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Start New Exam</h1>
        <p className="text-slate-500 dark:text-slate-400">Choose your exam type and settings.</p>
      </div>

      {loadingData ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Mode Selection */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h2 className="font-semibold text-lg">Exam Type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {modeCards.map(({ id, title, description }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === id
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="font-semibold mb-1 text-sm">{title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* MOCK — Template Selection */}
          {mode === "MOCK" && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h2 className="font-semibold text-lg">Template</h2>
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500">No exam templates available.</p>
              ) : (
                <div className="space-y-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedTemplate === t.id
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="font-semibold">{t.name}</div>
                      {t.description && (
                        <div className="text-sm text-slate-500 mt-0.5">{t.description}</div>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span>{t.totalQuestions} questions</span>
                        <span>{t.durationMinutes} minutes</span>
                        <span>{t.subjects.map((s) => s.subject.name).join(", ")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {activeTemplate && (
                <p className="text-xs text-slate-500">
                  Questions distributed as:{" "}
                  {activeTemplate.subjects.map((s) => `${s.subject.name} (${s.questionCount})`).join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* PRACTICE — Subject + Question Count */}
          {mode === "PRACTICE" && (
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <h2 className="font-semibold text-lg">Subject</h2>
              {subjects.length === 0 ? (
                <p className="text-sm text-slate-500">No subjects available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubject(s.id)}
                      disabled={s._count.questions === 0}
                      className={`p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedSubject === s.id
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{s._count.questions} questions</div>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Questions</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="w-12 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                    {questionCount}
                  </span>
                </div>
                <p className="text-xs text-slate-500">~{questionCount * 2} minutes</p>
              </div>
            </div>
          )}

          {/* TOPIC — Subject + Topic Selection + Question Count */}
          {mode === "TOPIC" && (
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <div>
                <h2 className="font-semibold text-lg mb-3">Subject</h2>
                {subjects.length === 0 ? (
                  <p className="text-sm text-slate-500">No subjects available.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subjects.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSubject(s.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          selectedSubject === s.id
                            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="font-medium text-sm">{s.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="font-semibold text-lg mb-3">Topic</h2>
                {loadingTopics ? (
                  <p className="text-sm text-slate-500">Loading topics…</p>
                ) : topics.length === 0 ? (
                  <p className="text-sm text-slate-500">No topics available for this subject.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTopic(t.id)}
                        disabled={t._count.questions === 0}
                        className={`w-full p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          selectedTopic === t.id
                            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t._count.questions} questions</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Questions</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={5}
                    value={Math.min(questionCount, 30)}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="w-12 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                    {Math.min(questionCount, 30)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={
              starting ||
              (mode === "MOCK" ? !selectedTemplate : mode === "TOPIC" ? !selectedTopic : !selectedSubject)
            }
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {starting ? (
              "Starting…"
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start Exam
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
