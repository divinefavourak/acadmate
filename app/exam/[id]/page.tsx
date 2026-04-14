"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Timer from "../components/Timer";
import QuestionGrid from "../components/QuestionGrid";
import Calculator from "../components/Calculator";
import MathText from "@/app/components/MathText";

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
  const [reportedQuestions, setReportedQuestions] = useState<Set<string>>(new Set());

  // Fetch exam session
  useEffect(() => {
    fetch(`/api/exams/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        const s: ExamSession = data.examSession;
        setSession(s);
        // Pre-populate saved answers
        const saved: Record<string, string | null> = {};
        for (const a of s.userAnswers) saved[a.questionId] = a.optionId;
        setAnswers(saved);
        // Pre-populate marked review
        const marked: Record<string, boolean> = {};
        for (const sq of s.questions) {
          if (sq.markedReview) marked[sq.question.id] = true;
        }
        setMarkedReview(marked);
      })
      .catch(() => setError("Failed to load exam. Please refresh."))
      .finally(() => setLoading(false));
  }, [id]);

  const questions = session?.questions ?? [];
  const currentSQ = questions[currentIndex];
  const currentQ = currentSQ?.question;

  // Auto-save answer to backend
  const saveAnswer = useCallback(
    async (questionId: string, optionId: string | null) => {
      await fetch(`/api/exams/${id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [{ questionId, optionId }] }),
      });
    },
    [id]
  );

  // Toggle mark for review
  const toggleMarkReview = useCallback(
    async (questionId: string) => {
      const next = !markedReview[questionId];
      setMarkedReview((prev) => ({ ...prev, [questionId]: next }));
      await fetch(`/api/exams/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, markedReview: next }),
      });
    },
    [id, markedReview]
  );

  const handleOptionSelect = (optionId: string) => {
    const qid = currentQ.id;
    setAnswers((prev) => ({ ...prev, [qid]: optionId }));
    saveAnswer(qid, optionId);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const confirmed = window.confirm(
      "Are you sure you want to submit your exam? This cannot be undone."
    );
    if (!confirmed) return;

    setSubmitting(true);
    const res = await fetch(`/api/exams/${id}/submit`, { method: "POST" });
    const data = await res.json();

    if (res.ok && data.result?.id) {
      router.push(`/results/${data.result.id}`);
    } else {
      alert("Failed to submit exam. Please try again.");
      setSubmitting(false);
    }
  };

  const handleReportQuestion = useCallback(
    async (questionId: string) => {
      if (reportedQuestions.has(questionId)) return;
      setReportedQuestions((prev) => new Set(prev).add(questionId));
      await fetch(`/api/questions/${questionId}/flag`, { method: "POST" });
    },
    [reportedQuestions]
  );

  const handleExpire = async () => {
    const res = await fetch(`/api/exams/${id}/submit`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.result?.id) {
      router.push(`/results/${data.result.id}?timeout=1`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-500">Loading exam…</div>
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
                <span className="hidden sm:inline">{currentQ.subject.name} — {session.mode === "MOCK" ? "Mock Exam" : "Practice"}</span>
                <span className="sm:hidden">{currentIndex + 1}/{questions.length}</span>
              </span>
              <span className="lg:hidden text-xs text-indigo-500 flex-shrink-0">↑ Navigator</span>
            </button>
          </div>

          <Timer initialMinutes={minutesRemaining} onExpire={handleExpire} />

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

      {/* Calculator modal */}
      {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

      {/* Right Sidebar */}
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
