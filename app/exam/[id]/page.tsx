"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Timer from "../components/Timer";
import QuestionGrid from "../components/QuestionGrid";
import Calculator from "../components/Calculator";
import MathText from "@/app/components/MathText";
import Loader from "@/app/components/Loader";
import { apiClient } from "@/lib/api/client";
import { useExamGuard } from "../hooks/useExamGuard";
import type { StrikeWarning } from "../hooks/useExamGuard";
import ExamBriefing from "../components/ExamBriefing";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option {
  id: string;
  label: string;
  text: string;
  sortOrder: number;
}

interface Question {
  id: string;
  text: string;
  imageUrl: string | null;
  subject: { id: string; name: string; code: string };
  topic: { id: string; name: string } | null;
  options: Option[];
}

interface SessionQuestion {
  position: number;
  markedReview: boolean;
  question: Question;
}

interface ExamSession {
  id: string;
  mode: string;
  status: string;
  totalQuestions: number;
  durationMinutes: number;
  expiresAt: string | null;
  startedAt: string;
  questions: SessionQuestion[];
  userAnswers: { questionId: string; optionId: string | null }[];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [markedReview, setMarkedReview] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reportedQuestions, setReportedQuestions] = useState<Set<string>>(new Set());
  const [examStarted, setExamStarted] = useState(false);

  // Fetch exam session
  useEffect(() => {
    apiClient<{ examSession: ExamSession }>(`/api/exams/${id}`)
      .then(({ examSession: s }) => {
        // Already finished — send to results page instead of showing exam UI
        if (s.status === "SUBMITTED" || s.status === "TIMED_OUT") {
          apiClient<{ result: { id: string } }>(`/api/results?examSessionId=${id}&limit=1`)
            .then((d) => {
              const resultId = (d as any)?.results?.[0]?.id;
              router.replace(resultId ? `/results/${resultId}` : "/results");
            })
            .catch(() => router.replace("/results"));
          return;
        }
        if (s.status === "ABANDONED") {
          router.replace("/results");
          return;
        }
        setSession(s);
        const saved: Record<string, string | null> = {};
        for (const a of s.userAnswers) saved[a.questionId] = a.optionId;
        setAnswers(saved);
        const marked: Record<string, boolean> = {};
        for (const sq of s.questions) {
          if (sq.markedReview) marked[sq.question.id] = true;
        }
        setMarkedReview(marked);
      })
      .catch(() => setError("Failed to load exam. Please refresh."))
      .finally(() => setLoading(false));
  }, [id, router]);

  // Disable copy, cut, and right-click for the lifetime of the exam page
  useEffect(() => {
    if (!session) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [session]);

  const questions = session?.questions ?? [];
  const currentSQ = questions[currentIndex];
  const currentQ = currentSQ?.question;

  // Auto-save answer to backend
  const saveAnswer = useCallback(
    async (questionId: string, optionId: string | null) => {
      await apiClient(`/api/exams/${id}/answers`, {
        method: "POST",
        body: JSON.stringify({ answers: [{ questionId, optionId }] }),
      }).catch(() => {});
    },
    [id]
  );

  // Toggle mark for review
  const toggleMarkReview = useCallback(
    async (questionId: string) => {
      const next = !markedReview[questionId];
      setMarkedReview((prev) => ({ ...prev, [questionId]: next }));
      await apiClient(`/api/exams/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ questionId, markedReview: next }),
      }).catch(() => {});
    },
    [id, markedReview]
  );

  const handleOptionSelect = (optionId: string) => {
    const qid = currentQ.id;
    setAnswers((prev) => ({ ...prev, [qid]: optionId }));
    saveAnswer(qid, optionId);
  };

  const handleSubmit = () => {
    if (submitting) return;
    setSubmitError("");
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const data = await apiClient<{ result: { id: string } }>(`/api/exams/${id}/submit`, { method: "POST" });
      router.push(`/results/${data.result.id}`);
    } catch {
      setSubmitError("Failed to submit exam. Please try again.");
      setSubmitting(false);
    }
  };

  const handleReportQuestion = useCallback(
    async (questionId: string) => {
      if (reportedQuestions.has(questionId)) return;
      setReportedQuestions((prev) => new Set(prev).add(questionId));
      await apiClient(`/api/questions/${questionId}/flag`, { method: "POST" }).catch(() => {});
    },
    [reportedQuestions]
  );

  const handleExpire = async () => {
    try {
      const data = await apiClient<{ result: { id: string } }>(`/api/exams/${id}/submit`, { method: "POST" });
      router.push(`/results/${data.result.id}?timeout=1`);
    } catch { /* session already expired */ }
  };

  // Auto-submit used by the exam guard on strike exhaustion
  const handleAutoSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const data = await apiClient<{ result: { id: string } }>(`/api/exams/${id}/submit`, { method: "POST" });
      router.push(`/results/${data.result.id}?autosubmit=1`);
    } catch {
      setSubmitting(false);
    }
  }, [id, router, submitting]);

  const { strikes, warning, isFullscreen, dismissWarning, requestFullscreen } =
    useExamGuard(session !== null && examStarted, handleAutoSubmit);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="py-8" />
      </div>
    );
  }

  if (error || !session || !currentQ) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-red-500">{error || "Exam not found."}</div>
      </div>
    );
  }

  // Briefing gate — shown before the exam starts
  if (!examStarted) {
    return (
      <ExamBriefing
        mode={session.mode}
        totalQuestions={session.totalQuestions}
        durationMinutes={session.durationMinutes}
        onStart={() => setExamStarted(true)}
      />
    );
  }

  const answeredQuestionIds = new Set(
    Object.entries(answers)
      .filter(([, v]) => v !== null)
      .map(([k]) => k)
  );
  const answeredIndexes = questions
    .map((sq, i) => (answeredQuestionIds.has(sq.question.id) ? i : -1))
    .filter((i) => i >= 0);

  const markedIndexes = questions
    .map((sq, i) => (markedReview[sq.question.id] ? i : -1))
    .filter((i) => i >= 0);

  const minutesRemaining = session.expiresAt
    ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 60000))
    : session.durationMinutes;

  const isCurrentMarked = !!markedReview[currentQ.id];
  const hasMath = questions.some((sq) => sq.question.subject.code === "MTH");

  return (
    <div className="flex h-full w-full">
      {/* Mobile Question Navigator Sheet */}
      {showMobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileNav(false)} />
          <div className="relative bg-white dark:bg-slate-950 rounded-t-2xl p-5 shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base">Question Navigator</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {answeredIndexes.length} of {questions.length} answered
                  {markedIndexes.length > 0 && ` · ${markedIndexes.length} flagged`}
                </p>
              </div>
              <button onClick={() => setShowMobileNav(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <QuestionGrid
              totalQuestions={questions.length}
              currentQuestion={currentIndex}
              answeredQuestions={answeredIndexes}
              markedQuestions={markedIndexes}
              onSelect={(idx) => { setCurrentIndex(idx); setShowMobileNav(false); }}
            />
            <div className="flex items-center gap-4 mt-4 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />Current</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />Answered</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />Flagged</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 inline-block" />Unanswered</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Exam Area */}
      <main className="flex-1 flex flex-col items-center min-w-0">
        {/* Top Bar */}
        <header className="w-full flex items-center justify-between px-3 sm:px-8 py-2 sm:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Image
                src="/images/logo.jpg"
                alt="Acadmate Logo"
                width={28}
                height={28}
                className="rounded-lg shadow-md object-cover"
              />
              <span className="font-bold tracking-tight hidden sm:block">Acadmate CBT</span>
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block flex-shrink-0" />
            {/* Tappable progress — opens mobile navigator */}
            <button
              onClick={() => setShowMobileNav(true)}
              className="flex items-center gap-2 min-w-0 lg:cursor-default lg:pointer-events-none"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate text-sm sm:text-base">
                <span className="hidden sm:inline">
                  {currentQ.subject.name} —{" "}
                  {session.mode === "MOCK" ? "Mock Exam"
                    : session.mode === "POST_UTME" ? "Post-UTME"
                    : "Practice"}
                </span>
                <span className="sm:hidden">{currentIndex + 1}/{questions.length}</span>
              </span>
              <span className="lg:hidden text-xs text-indigo-500 flex-shrink-0">↑ Navigator</span>
            </button>
          </div>

          <Timer initialMinutes={minutesRemaining} onExpire={handleExpire} />

          {/* Fullscreen nudge + strike counter */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isFullscreen && (
              <button
                onClick={requestFullscreen}
                title="Enter fullscreen"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                Fullscreen
              </button>
            )}
            {strikes > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                ⚠ {strikes}/{2}
              </span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </header>

        {/* Question View */}
        <div className="w-full max-w-3xl px-4 sm:px-6 flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Scrollable question + options area */}
          <div className="flex-1 overflow-y-auto py-6 sm:py-10 min-h-0">
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 mb-3 sm:mb-4 flex-wrap">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                {currentQ.topic && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {currentQ.topic.name}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {/* Bookmark — mark for review */}
                  <button
                    onClick={() => toggleMarkReview(currentQ.id)}
                    title={isCurrentMarked ? "Remove bookmark" : "Bookmark for review"}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                      isCurrentMarked
                        ? "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-400"
                        : "bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 hover:border-amber-400 hover:text-amber-600"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={isCurrentMarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                    </svg>
                    {isCurrentMarked ? "Saved" : "Save"}
                  </button>
                  {/* Flag — report bad question */}
                  <button
                    onClick={() => handleReportQuestion(currentQ.id)}
                    disabled={reportedQuestions.has(currentQ.id)}
                    title="Report an issue with this question"
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                      reportedQuestions.has(currentQ.id)
                        ? "bg-red-100 border-red-300 text-red-500 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400 opacity-70 cursor-not-allowed"
                        : "bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 hover:border-red-400 hover:text-red-500"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={reportedQuestions.has(currentQ.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                      <line x1="4" x2="4" y1="22" y2="15"/>
                    </svg>
                    {reportedQuestions.has(currentQ.id) ? "Reported" : "Report"}
                  </button>
                </div>
              </div>
              <h2 className="text-lg sm:text-2xl font-medium leading-relaxed text-slate-800 dark:text-slate-100">
                <MathText text={currentQ.text} />
              </h2>
              {currentQ.imageUrl && (
                <img
                  src={currentQ.imageUrl}
                  alt="Question diagram"
                  className="mt-4 max-h-64 rounded-xl border border-slate-200 dark:border-slate-800 object-contain"
                />
              )}
            </div>

            <div className="space-y-3 sm:space-y-4">
              {currentQ.options.map((option) => {
                const isSelected = answers[currentQ.id] === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex items-center p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/50 dark:bg-black/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQ.id}`}
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => handleOptionSelect(option.id)}
                    />
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm mr-3 sm:mr-4 transition-colors ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span
                      className={`text-base sm:text-lg ${
                        isSelected
                          ? "font-medium text-indigo-900 dark:text-indigo-100"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <MathText text={option.text} />
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Navigation — always pinned at the bottom */}
          <div className="flex-shrink-0 flex items-center justify-between py-3 sm:py-5 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold flex items-center gap-2 transition-all text-sm sm:text-base ${
                currentIndex === 0
                  ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 text-slate-400"
                  : "btn-secondary"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Previous
            </button>

            {/* Calculator trigger — only shown when Mathematics is in the session */}
            {hasMath && (
              <button
                onClick={() => setShowCalculator(true)}
                title="Open calculator"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-semibold"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="16" height="20" x="4" y="2" rx="2" />
                  <line x1="8" x2="16" y1="6" y2="6" />
                  <line x1="8" x2="8" y1="12" y2="12" />
                  <line x1="12" x2="12" y1="12" y2="12" />
                  <line x1="16" x2="16" y1="12" y2="12" />
                  <line x1="8" x2="8" y1="16" y2="16" />
                  <line x1="12" x2="12" y1="16" y2="16" />
                  <line x1="16" x2="16" y1="16" y2="16" />
                  <line x1="8" x2="8" y1="20" y2="20" />
                  <line x1="12" x2="16" y1="20" y2="20" />
                </svg>
                <span className="hidden sm:inline">Calculator</span>
              </button>
            )}

            <button
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
              className={`px-5 py-2.5 sm:px-8 sm:py-3 rounded-xl font-semibold flex items-center gap-2 transition-all text-sm sm:text-base ${
                currentIndex === questions.length - 1
                  ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 text-slate-400"
                  : "btn-primary"
              }`}
            >
              Next
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Strike warning modal */}
      {warning && <StrikeWarningModal warning={warning} onDismiss={dismissWarning} />}

      {/* Calculator modal */}
      {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !submitting && setShowSubmitConfirm(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <path d="M12 9v4"/>
                  <path d="M12 17h.01"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="submit-confirm-title" className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Submit exam?
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Once submitted, you can&apos;t change your answers.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Answered</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {answeredIndexes.length} / {questions.length}
                </span>
              </div>
              {questions.length - answeredIndexes.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Unanswered</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {questions.length - answeredIndexes.length}
                  </span>
                </div>
              )}
              {markedIndexes.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Flagged for review</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {markedIndexes.length}
                  </span>
                </div>
              )}
            </div>

            {submitError && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{submitError}</p>
            )}

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep working
              </button>
              <button
                onClick={confirmSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "Submit exam"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar — question navigator */}
      <aside className="w-80 bg-white/90 dark:bg-black/90 backdrop-blur-md border-l border-slate-200 dark:border-slate-800 flex-col hidden lg:flex">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg">Question Navigator</h3>
          <p className="text-sm text-slate-500 mt-1">
            {answeredIndexes.length} of {questions.length} answered
            {markedIndexes.length > 0 && ` · ${markedIndexes.length} flagged`}
          </p>
        </div>

        <div className="flex-1 p-6 flex flex-col">
          <QuestionGrid
            totalQuestions={questions.length}
            currentQuestion={currentIndex}
            answeredQuestions={answeredIndexes}
            markedQuestions={markedIndexes}
            onSelect={(idx) => setCurrentIndex(idx)}
          />

          <div className="mt-8 space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
              <span className="text-sm font-medium">Current</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Answered</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Flagged for Review</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600"></div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Unanswered</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── Strike Warning Modal ─────────────────────────────────────────────────────

function StrikeWarningModal({
  warning,
  onDismiss,
}: {
  warning: StrikeWarning;
  onDismiss: () => void;
}) {
  const { type, strike, isFinal } = warning;

  const reason =
    type === "tab"
      ? "You switched to another tab or window"
      : "You exited fullscreen mode";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Coloured top bar */}
        <div className={`h-1.5 w-full ${isFinal ? "bg-red-600" : "bg-amber-500"}`} />

        <div className="p-6 sm:p-8 space-y-5">
          {/* Icon + heading */}
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              isFinal ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"
            }`}>
              {isFinal ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                  <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
                </svg>
              )}
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {isFinal ? "Exam Auto-Submitted" : `Strike ${strike} of ${2}`}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{reason}</p>
            </div>
          </div>

          {/* Body */}
          <div className={`rounded-xl p-4 text-sm ${
            isFinal
              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
              : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
          }`}>
            {isFinal
              ? "You have used both strikes. Your exam is being submitted now. You will be redirected to your results shortly."
              : `This is a monitored exam. One more violation will automatically submit your exam.`}
          </div>

          {/* Action */}
          {!isFinal && (
            <button
              onClick={onDismiss}
              className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              I understand — return to exam
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
