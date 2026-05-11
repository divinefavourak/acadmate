"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";
import Folder from "@/app/admin/components/Folder";

const SUBJECT_COLORS = [
  "#4F46E5", "#7C3AED", "#2563EB", "#0891B2",
  "#059669", "#65A30D", "#D97706", "#DC2626",
];

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

interface ProseText {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  _count: { questions: number };
}

type Mode = "MOCK" | "PRACTICE" | "TOPIC" | "POST_UTME";

export default function NewExamPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [proseTexts, setProseTexts] = useState<ProseText[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [mode, setMode] = useState<Mode>("MOCK");

  // MOCK state
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedProseId, setSelectedProseId] = useState<string>("");

  // PRACTICE / TOPIC state
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [questionCount, setQuestionCount] = useState(40);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      apiClient<{ subjects: Subject[] }>("/api/subjects"),
      apiClient<{ texts: ProseText[] }>("/api/prose"),
    ]).then(([sResult, pResult]) => {
      const subjList = sResult.status === "fulfilled" ? (sResult.value.subjects ?? []) : [];
      const proseList = pResult.status === "fulfilled" ? (pResult.value.texts ?? []) : [];
      setSubjects(subjList);
      setProseTexts(proseList);
      if (subjList.length > 0) setSelectedSubject(subjList[0].id);
    }).finally(() => setLoadingData(false));
  }, []);

  // Fetch topics when subject changes (TOPIC mode)
  useEffect(() => {
    if (mode !== "TOPIC" || !selectedSubject) return;
    setLoadingTopics(true);
    setSelectedTopic("");
    apiClient<{ topics: Topic[] }>(`/api/topics?subjectId=${selectedSubject}`)
      .then((data) => {
        const list = data.topics ?? [];
        setTopics(list);
        if (list.length > 0) setSelectedTopic(list[0].id);
      })
      .catch(() => setTopics([]))
      .finally(() => setLoadingTopics(false));
  }, [mode, selectedSubject]);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  }

  async function handleStart() {
    setError("");

    if (mode === "POST_UTME") {
      router.push("/exam/post-utme/schools");
      return;
    }

    if (mode === "MOCK" && selectedSubjectIds.length !== 3) {
      setError("Please select exactly 3 subjects (Use of English is already included).");
      return;
    }
    if (mode === "PRACTICE" && !selectedSubject) {
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
        ? {
            mode: "MOCK",
            subjectIds: selectedSubjectIds,
            ...(selectedProseId ? { proseTextId: selectedProseId } : {}),
          }
        : mode === "TOPIC"
        ? { mode: "TOPIC", subjectId: selectedSubject, topicId: selectedTopic, questionCount }
        : { mode: "PRACTICE", subjectId: selectedSubject, questionCount };

    try {
      const data = await apiClient<{ examSession: { id: string } }>("/api/exams", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/exam/${data.examSession.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start exam. Please try again.");
      setStarting(false);
    }
  }

  const englishSubject = subjects.find((s) => s.code === "ENG");
  const otherSubjects = subjects.filter((s) => s.code !== "ENG");
  const remaining = 3 - selectedSubjectIds.length;

  const modeCards: { id: Mode; title: string; description: string }[] = [
    { id: "MOCK", title: "Full UTME Mock", description: "Timed exam across all 4 subjects, just like the real UTME." },
    { id: "PRACTICE", title: "Subject Practice", description: "Focus on a single subject at your own pace." },
    { id: "TOPIC", title: "Topic Drill", description: "Deep-dive into a specific topic within a subject." },
    { id: "POST_UTME", title: "Post-UTME", description: "Practice with real past questions from your target institution." },
  ];

  const startDisabled =
    starting ||
    (mode === "MOCK"
      ? selectedSubjectIds.length !== 3
      : mode === "TOPIC"
      ? !selectedTopic
      : mode === "POST_UTME"
      ? false // never disabled — card click handles navigation
      : !selectedSubject);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Start New Exam</h1>
        <p className="text-slate-500 dark:text-slate-400">Choose your exam type and settings.</p>
      </div>

      {loadingData ? (
        <Loader className="py-4" />
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

          {/* MOCK — UTME Subject Selection */}
          {mode === "MOCK" && (
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <div>
                <h2 className="font-semibold text-lg">Your Subjects</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Use of English is compulsory for all candidates. Select 3 more subjects.
                </p>
              </div>

              {/* Use of English — locked/compulsory */}
              <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">
                    {englishSubject?.name ?? "Use of English"}
                  </div>
                  <div className="text-xs text-slate-500">30 objective + 10 prose questions</div>
                </div>
                <span className="ml-auto flex-shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                  Compulsory
                </span>
              </div>

              {/* Selectable subjects */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">
                    {remaining > 0
                      ? `Choose ${remaining} more subject${remaining !== 1 ? "s" : ""}`
                      : "3 subjects selected"}
                  </span>
                  {selectedSubjectIds.length > 0 && (
                    <button
                      onClick={() => setSelectedSubjectIds([])}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {otherSubjects.map((s, i) => {
                    const isSelected = selectedSubjectIds.includes(s.id);
                    const isDisabled = (!isSelected && selectedSubjectIds.length >= 3) || s._count.questions === 0;
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSubject(s.id)}
                        disabled={isDisabled}
                        className="flex flex-col items-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                      >
                        <Folder
                          color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                          size={1.05}
                          open={isSelected}
                          onToggle={() => toggleSubject(s.id)}
                        />
                        <span className={`text-xs font-medium text-center leading-tight transition-colors ${
                          isSelected ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                        }`}>
                          {s.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prose / Comprehension text picker */}
              {proseTexts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">Prose / Comprehension Text</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    10 comprehension questions will be drawn from this text as part of Use of English.
                  </p>
                  <div className="space-y-2">
                    {/* Random option */}
                    <button
                      onClick={() => setSelectedProseId("")}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                        selectedProseId === ""
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="font-medium text-sm">Random</div>
                      <div className="text-xs text-slate-500 mt-0.5">System picks a prose text for you</div>
                    </button>

                    {proseTexts.map((pt) => (
                      <button
                        key={pt.id}
                        onClick={() => setSelectedProseId(pt.id)}
                        disabled={pt._count.questions === 0}
                        className={`w-full p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          selectedProseId === pt.id
                            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="font-medium text-sm">{pt.title}</div>
                        {pt.author && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {pt.author}{pt.year ? ` · ${pt.year}` : ""}
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">{pt._count.questions} questions</div>
                      </button>
                    ))}
                  </div>
                </div>
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
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {subjects.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubject(s.id)}
                      disabled={s._count.questions === 0}
                      className="flex flex-col items-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                    >
                      <Folder
                        color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                        size={1.05}
                        open={selectedSubject === s.id}
                        onToggle={() => setSelectedSubject(s.id)}
                      />
                      <span className={`text-xs font-medium text-center leading-tight transition-colors ${
                        selectedSubject === s.id ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                      }`}>
                        {s.name}
                      </span>
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

          {/* TOPIC — Subject + Topic + Question Count */}
          {mode === "TOPIC" && (
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <div>
                <h2 className="font-semibold text-lg mb-3">Subject</h2>
                {subjects.length === 0 ? (
                  <p className="text-sm text-slate-500">No subjects available.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {subjects.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSubject(s.id)}
                        className="flex flex-col items-center gap-2 group focus:outline-none"
                      >
                        <Folder
                          color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                          size={1.05}
                          open={selectedSubject === s.id}
                          onToggle={() => setSelectedSubject(s.id)}
                        />
                        <span className={`text-xs font-medium text-center leading-tight transition-colors ${
                          selectedSubject === s.id ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                        }`}>
                          {s.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="font-semibold text-lg mb-3">Topic</h2>
                {loadingTopics ? (
                  <Loader className="py-2" />
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

          {/* POST_UTME — info banner (no inline config, wizard handles it) */}
          {mode === "POST_UTME" && (
            <div className="glass-panel p-5 rounded-2xl flex items-start gap-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
                  <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                  <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                  <path d="M12 3v6"/>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm mb-1">Institution-specific past papers</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Click &quot;Continue&quot; to choose your school and the year of paper you want to practice.
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
            disabled={startDisabled}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {starting ? (
              "Starting…"
            ) : mode === "POST_UTME" ? (
              <>
                Continue
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start Exam
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
