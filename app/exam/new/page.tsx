"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";
import Folder from "@/app/components/Folder";
import { track } from "@/lib/track";

const SUBJECT_COLORS = [
  "#4F46E5", "#7C3AED", "#2563EB", "#0891B2",
  "#059669", "#65A30D", "#D97706", "#DC2626",
];

// Compulsory subjects auto-added to Post-UTME papers; only electives count
// toward the combination requirement.
const COMPULSORY_CODES = ["ENG", "MTH", "GEN"];

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

interface MeForExam {
  studentProfile: {
    courseSubjectCombinations: { subjectId: string }[];
  } | null;
}

type Mode = "MOCK" | "PRACTICE" | "TOPIC" | "POST_UTME";

interface ExamAvailability {
  utme: boolean;
  postUtme: boolean;
}

// GET /api/users/me/quota. perSubject is null when there's no lifetime limit
// (Premium, or the admin hasn't switched it on).
interface Quota {
  plan: "FREE" | "PREMIUM";
  perSubject: number | null;
  used: Record<string, number>;
  /** Referral bonus questions, usable in any subject once its own run out. */
  bonus?: { total: number; left: number };
}

type Paywall = { kind: "premium" | "quota" } | null;

// A paywall the server answered with, tied to the request that got it, so
// switching subject while a start is pending can't move it onto another one.
type ServerPaywall = { kind: "premium" | "quota"; mode: Mode; subjectId: string } | null;

// MOCK/PRACTICE/TOPIC are "UTME" exams; POST_UTME is its own group.
function modeAvailable(mode: Mode, availability: ExamAvailability | null): boolean {
  if (!availability) return true; // assume open until we know otherwise
  return mode === "POST_UTME" ? availability.postUtme : availability.utme;
}

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
  const [utmeComboCount, setUtmeComboCount] = useState<number | null>(null);
  const [availability, setAvailability] = useState<ExamAvailability | null>(null);
  // Null until loaded, or if the API doesn't have the endpoint: the picker then
  // behaves as before and the server's 402 is the only paywall signal.
  const [quota, setQuota] = useState<Quota | null>(null);
  const [paywall, setPaywall] = useState<ServerPaywall>(null);
  const preferredTopicRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiClient<{ subjects: Subject[] }>("/api/subjects"),
      apiClient<{ texts: ProseText[] }>("/api/prose"),
      apiClient<MeForExam>("/api/users/me"),
      apiClient<ExamAvailability>("/api/settings/exam-availability"),
      apiClient<Quota>("/api/users/me/quota"),
    ]).then(([sResult, pResult, meResult, availResult, quotaResult]) => {
      if (quotaResult.status === "fulfilled") setQuota(quotaResult.value);
      const subjList = sResult.status === "fulfilled" ? (sResult.value.subjects ?? []) : [];
      const proseList = pResult.status === "fulfilled" ? (pResult.value.texts ?? []) : [];
      setSubjects(subjList);
      setProseTexts(proseList);
      if (subjList.length > 0) setSelectedSubject(subjList[0].id);
      // Study and the public past-question pages hand off here with
      // ?mode=TOPIC&subjectId=…&topicId=… (Topic Drill) or ?mode=PRACTICE&subjectId=….
      const handoff = new URLSearchParams(window.location.search);
      const handoffSubject = subjList.find((s) => s.id === handoff.get("subjectId"));
      const utmeOpen = availResult.status !== "fulfilled" || availResult.value.utme;
      if (handoff.get("mode") === "TOPIC" && handoffSubject && utmeOpen) {
        preferredTopicRef.current = handoff.get("topicId");
        setMode("TOPIC");
        setSelectedSubject(handoffSubject.id);
      } else if (handoff.get("mode") === "PRACTICE" && handoffSubject && utmeOpen) {
        setMode("PRACTICE");
        setSelectedSubject(handoffSubject.id);
      }
      if (meResult.status === "fulfilled") {
        // Count electives only — legacy combos may still include compulsory IDs.
        const compulsoryIds = new Set(
          subjList.filter((s) => COMPULSORY_CODES.includes(s.code)).map((s) => s.id),
        );
        const electiveCount = (meResult.value.studentProfile?.courseSubjectCombinations ?? [])
          .filter((c) => !compulsoryIds.has(c.subjectId)).length;
        setUtmeComboCount(electiveCount);
      }
      // Default to the first available exam group so a student never lands on a
      // disabled type (e.g. UTME closed during Post-UTME season).
      if (availResult.status === "fulfilled") {
        const avail = availResult.value;
        setAvailability(avail);
        if (!avail.utme && avail.postUtme) setMode("POST_UTME");
      }
    }).finally(() => setLoadingData(false));
  }, []);

  const utmeComboMissing = utmeComboCount !== null && utmeComboCount < 2;

  // Fetch topics when subject changes (TOPIC mode)
  useEffect(() => {
    if (mode !== "TOPIC" || !selectedSubject) return;
    setLoadingTopics(true);
    setSelectedTopic("");
    apiClient<{ topics: Topic[] }>(`/api/subjects/${selectedSubject}/topics`)
      .then((data) => {
        const list = data.topics ?? [];
        setTopics(list);
        const preferred = list.find((t) => t.id === preferredTopicRef.current);
        preferredTopicRef.current = null;
        if (list.length > 0) setSelectedTopic((preferred ?? list[0]).id);
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

  const isFree = quota?.plan === "FREE";
  const limited = isFree && quota?.perSubject != null;

  // Free questions left in a subject, or null when there's no limit.
  function freeLeft(subjectId: string): number | null {
    if (!limited || !quota || quota.perSubject == null) return null;
    return Math.max(0, quota.perSubject - (quota.used[subjectId] ?? 0)) + (quota.bonus?.left ?? 0);
  }

  const selectedLeft = mode === "PRACTICE" || mode === "TOPIC" ? freeLeft(selectedSubject) : null;
  // Shown before the student presses Start, when we already know the answer.
  const knownPaywall: Paywall =
    isFree && (mode === "MOCK" || mode === "POST_UTME")
      ? { kind: "premium" }
      : selectedLeft === 0
      ? { kind: "quota" }
      : null;
  const serverPaywall: Paywall =
    paywall && paywall.mode === mode && (mode === "MOCK" || paywall.subjectId === selectedSubject)
      ? { kind: paywall.kind }
      : null;
  const activePaywall = knownPaywall ?? serverPaywall;

  function chooseMode(next: Mode) {
    setMode(next);
    setPaywall(null);
    setError("");
  }

  function chooseSubject(id: string) {
    setSelectedSubject(id);
    setPaywall(null);
    setError("");
  }

  async function handleStart() {
    setError("");
    setPaywall(null);

    if (!modeAvailable(mode, availability)) {
      setError(
        mode === "POST_UTME"
          ? "Post-UTME exams are currently turned off. Please check back soon."
          : "UTME practice exams are currently turned off. Please check back soon.",
      );
      return;
    }

    if (mode === "POST_UTME") {
      if (utmeComboMissing) {
        setError("Set your UTME subject combination in your profile before starting Post-UTME.");
        return;
      }
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
    // What this request is for; the selection may change while it's pending.
    const requested = { mode, subjectId: selectedSubject };

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
      if (err instanceof ApiError && err.status === 402) {
        if (err.body.error === "QUOTA_EXHAUSTED") {
          setPaywall({ kind: "quota", ...requested });
          // Our copy of the count was stale (another tab, or a session
          // started elsewhere). Mark the requested subject as used up.
          setQuota((q) =>
            q && q.perSubject != null
              ? {
                  ...q,
                  used: { ...q.used, [requested.subjectId]: q.perSubject },
                  // The server only says "used up" once the bonus is gone too.
                  bonus: q.bonus ? { ...q.bonus, left: 0 } : q.bonus,
                }
              : q,
          );
        } else {
          setPaywall({ kind: "premium", ...requested });
        }
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to start exam. Please try again.");
      }
      setStarting(false);
    }
  }

  const englishSubject = subjects.find((s) => s.code === "ENG");
  const otherSubjects = subjects.filter((s) => s.code !== "ENG");
  const remaining = 3 - selectedSubjectIds.length;

  // What the Free plan gets in practice modes. Premium accounts see no note.
  const freeNote =
    quota?.plan === "PREMIUM"
      ? ""
      : quota?.perSubject != null
      ? ` Free plan: ${quota.perSubject} questions per subject.`
      : " (up to 20 questions on free plan)";

  const modeCards: { id: Mode; title: string; description: string; premium?: boolean }[] = [
    { id: "MOCK", title: "Full UTME Mock", description: "Timed exam across all 4 subjects, just like the real UTME.", premium: true },
    { id: "PRACTICE", title: "Subject Practice", description: `Focus on a single subject at your own pace.${freeNote}` },
    { id: "TOPIC", title: "Topic Drill", description: `Deep-dive into a specific topic within a subject.${freeNote}` },
    { id: "POST_UTME", title: "Post-UTME", description: "Practice with real past questions from your target institution.", premium: true },
  ];

  const startDisabled =
    starting ||
    activePaywall !== null ||
    !modeAvailable(mode, availability) ||
    (mode === "MOCK"
      ? selectedSubjectIds.length !== 3
      : mode === "TOPIC"
      ? !selectedTopic
      : mode === "POST_UTME"
      ? utmeComboMissing
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
              {modeCards.map(({ id, title, description, premium }) => {
                const available = modeAvailable(id, availability);
                return (
                  <button
                    key={id}
                    onClick={() => available && chooseMode(id)}
                    disabled={!available}
                    aria-disabled={!available}
                    className={`p-4 rounded-xl border-2 text-left transition-all relative disabled:cursor-not-allowed ${
                      !available
                        ? "border-slate-200 dark:border-slate-800 opacity-50"
                        : mode === id
                        ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {premium && available && (
                      <span className="absolute top-2 right-2 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Premium
                      </span>
                    )}
                    {!available && (
                      <span className="absolute top-2 right-2 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
                        Unavailable
                      </span>
                    )}
                    <div className="font-semibold mb-1 text-sm pr-14">{title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>
                  </button>
                );
              })}
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
              <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-brand-500 bg-brand-50/50 dark:bg-brand-900/20">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
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
                <span className="ml-auto flex-shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-900/40 px-2 py-0.5 rounded-full">
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
                          isSelected ? "text-brand-400" : "text-slate-400 group-hover:text-slate-200"
                        }`}>
                          {s.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Set novel picker (JAMB's recommended text for Use of English) */}
              {proseTexts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">Set novel</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    10 Use of English questions will be on this novel, and each one names it.
                  </p>
                  <div className="space-y-2">
                    {/* Random option */}
                    <button
                      onClick={() => setSelectedProseId("")}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                        selectedProseId === ""
                          ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="font-medium text-sm">Random</div>
                      <div className="text-xs text-slate-500 mt-0.5">We pick one of the set novels for you</div>
                    </button>

                    {proseTexts.map((pt) => (
                      <button
                        key={pt.id}
                        onClick={() => setSelectedProseId(pt.id)}
                        disabled={pt._count.questions === 0}
                        className={`w-full p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          selectedProseId === pt.id
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20"
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
                      onClick={() => chooseSubject(s.id)}
                      disabled={s._count.questions === 0}
                      className="flex flex-col items-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                    >
                      <Folder
                        color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                        size={1.05}
                        open={selectedSubject === s.id}
                        onToggle={() => chooseSubject(s.id)}
                      />
                      <span className={`text-xs font-medium text-center leading-tight transition-colors ${
                        selectedSubject === s.id ? "text-brand-400" : "text-slate-400 group-hover:text-slate-200"
                      }`}>
                        {s.name}
                      </span>
                      <FreeLeftLabel left={freeLeft(s.id)} />
                    </button>
                  ))}
                </div>
              )}
              {limited ? (
                <FreeSessionNote left={selectedLeft} subject={subjects.find((s) => s.id === selectedSubject)?.name} />
              ) : (
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
                    className="flex-1 accent-brand-500"
                  />
                  <span className="w-12 text-right font-semibold text-brand-600 dark:text-brand-400">
                    {questionCount}
                  </span>
                </div>
                <p className="text-xs text-slate-500">~{questionCount * 2} minutes</p>
              </div>
              )}
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
                        onClick={() => chooseSubject(s.id)}
                        className="flex flex-col items-center gap-2 group focus:outline-none"
                      >
                        <Folder
                          color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                          size={1.05}
                          open={selectedSubject === s.id}
                          onToggle={() => chooseSubject(s.id)}
                        />
                        <span className={`text-xs font-medium text-center leading-tight transition-colors ${
                          selectedSubject === s.id ? "text-brand-400" : "text-slate-400 group-hover:text-slate-200"
                        }`}>
                          {s.name}
                        </span>
                        <FreeLeftLabel left={freeLeft(s.id)} />
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
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20"
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

              {limited ? (
                <FreeSessionNote left={selectedLeft} subject={subjects.find((s) => s.id === selectedSubject)?.name} />
              ) : (
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
                    className="flex-1 accent-brand-500"
                  />
                  <span className="w-12 text-right font-semibold text-brand-600 dark:text-brand-400">
                    {Math.min(questionCount, 30)}
                  </span>
                </div>
              </div>
              )}
            </div>
          )}

          {/* POST_UTME — info banner (no inline config, wizard handles it) */}
          {mode === "POST_UTME" && (
            <div className="space-y-3">
              <div className="glass-panel p-5 rounded-2xl flex items-start gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600 dark:text-brand-400">
                    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                    <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                    <path d="M12 3v6"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm mb-1">Institution-specific past papers</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Each Post-UTME paper is composed of English + Math + General Knowledge + your UTME subject combination. Click &quot;Continue&quot; to pick your school and year.
                  </div>
                </div>
              </div>

              {utmeComboMissing && (
                <div className="p-4 rounded-2xl bg-amber-500/8 border border-amber-500/25 flex items-start gap-3">
                  <span className="text-xl shrink-0">⚠️</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-300 text-sm mb-1">UTME combination not set</p>
                    <p className="text-xs text-slate-400 mb-2">
                      Post-UTME papers pull from your UTME subjects. Set them in your profile first.
                    </p>
                    <Link
                      href="/dashboard/profile"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      Set my UTME subjects
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {activePaywall ? (
            <UpgradePanel
              paywall={activePaywall}
              mode={mode}
              subject={subjects.find((s) => s.id === selectedSubject)?.name}
              perSubject={quota?.perSubject ?? null}
              othersLeft={subjects.some((s) => s.id !== selectedSubject && (freeLeft(s.id) ?? 0) > 0)}
            />
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}

// "7 free left" under a subject, for Free accounts while the limit is on.
function FreeLeftLabel({ left }: { left: number | null }) {
  if (left === null) return null;
  return left > 0 ? (
    <span className="-mt-1 text-[11px] font-semibold text-mint-600 dark:text-mint-400">{left} free left</span>
  ) : (
    <span className="-mt-1 text-[11px] font-semibold text-slate-400">Premium</span>
  );
}

// Takes the place of the question-count slider for Free accounts: the session
// is whatever they have left, up to the server's default length.
function FreeSessionNote({ left, subject }: { left: number | null; subject?: string }) {
  if (left === null || left === 0) return null;
  return (
    <div className="rounded-xl border border-mint-500/30 bg-mint-500/10 px-4 py-3 text-sm">
      <p className="font-semibold text-slate-800 dark:text-slate-100">
        {left} free question{left === 1 ? "" : "s"} left{subject ? ` in ${subject}` : ""}
      </p>
      <p className="mt-0.5 text-slate-600 dark:text-slate-400">
        Each one is new to you, up to 10 a session. Premium has no limit and lets you choose how many to take.
      </p>
    </div>
  );
}

// Shown in place of the Start button when the choice needs Premium.
function UpgradePanel({
  paywall,
  mode,
  subject,
  perSubject,
  othersLeft,
}: {
  paywall: NonNullable<Paywall>;
  mode: Mode;
  subject?: string;
  perSubject: number | null;
  othersLeft: boolean;
}) {
  const title =
    paywall.kind === "quota"
      ? `You’ve used your ${perSubject ?? ""} free ${subject ?? ""} questions`.replace(/\s+/g, " ")
      : mode === "POST_UTME"
      ? "Post-UTME papers are part of Premium"
      : mode === "MOCK"
      ? "Full UTME mocks are part of Premium"
      : "This needs Premium";
  const body =
    paywall.kind === "quota"
      ? `Premium unlocks every question in every subject, plus full timed mocks.${othersLeft ? " Your other subjects still have free questions." : ""}`
      : "Premium is one payment. It unlocks full timed mocks, Post-UTME papers and every question in every subject.";
  return (
    <div role="status" className="rounded-2xl border border-brand-500/30 bg-brand-50/60 dark:bg-brand-900/20 p-5 space-y-4">
      <div>
        <p className="font-semibold text-lg text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{body}</p>
      </div>
      <Link
        href="/dashboard/upgrade"
        onClick={() => track("upgrade_click", { from: "exam_picker", reason: paywall.kind, mode })}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        See Premium
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </Link>
    </div>
  );
}
