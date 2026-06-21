"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { mockFetch } from "@/lib/api/mockClient";
import { useExamGuard } from "@/app/exam/hooks/useExamGuard";
import type { StrikeWarning } from "@/app/exam/hooks/useExamGuard";
import Calculator from "@/app/exam/components/Calculator";
import MathText from "@/app/components/MathText";
import ConfirmModal from "@/app/components/ConfirmModal";
import Image from "next/image";

interface Option { label: string; text: string }
interface Question { id: string; text: string; subject: string | null; imageUrl?: string | null; options: Option[] }

interface SessionData {
  sessionId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  durationMinutes: number;
  examTitle: string;
  examEndsAt: string;
  questions: Question[];
  savedAnswers: Record<string, string | null>;
}

export default function MockExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [panicking, setPanicking] = useState(false);
  const [panicMessage, setPanicMessage] = useState("");
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicSent, setPanicSent] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [confirmSubmitCount, setConfirmSubmitCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hasSubmittedRef = useRef(false);

  const submitSession = useCallback(async (sessionId: string, timedOut = false) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    // Flush any pending debounced answer saves before submitting
    for (const [qId, timeout] of Object.entries(savingRef.current)) {
      clearTimeout(timeout);
      delete savingRef.current[qId];
    }
    try {
      const endpoint = timedOut ? "timeout" : "submit";
      await mockFetch(`/api/mock/sessions/${sessionId}/${endpoint}`, id, { method: "POST" });
      router.push(`/mock/${id}/result/${sessionId}`);
    } catch {
      router.push(`/mock/${id}/result/${sessionId}`);
    }
  }, [id, router]);

  useEffect(() => {
    const token = localStorage.getItem(`mock_token_${id}`);
    if (!token) { router.replace(`/mock/${id}/login`); return; }

    // The session is created on the subjects/briefing page; here we only resume it.
    mockFetch<SessionData | null>("/api/mock/sessions/current", id)
      .then((data) => {
        if (!data) { router.replace(`/mock/${id}/subjects`); return; }
        if (data.status !== "IN_PROGRESS") {
          router.replace(`/mock/${id}/result/${data.sessionId}`);
          return;
        }
        setSession(data);
        setAnswers(data.savedAnswers);
        // Calculate remaining time anchored to server startedAt
        const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
        const examCloses = Math.floor((new Date(data.examEndsAt).getTime() - Date.now()) / 1000);
        const byDuration = data.durationMinutes * 60 - elapsed;
        const remaining = Math.max(0, Math.min(byDuration, examCloses));
        setSecondsLeft(remaining);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(`mock_token_${id}`);
          router.replace(`/mock/${id}/login`);
        } else if (err instanceof ApiError && err.status === 403) {
          setError(err.message);
        } else {
          setError("Failed to start session. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  // Timer countdown
  useEffect(() => {
    if (secondsLeft === null || !session) return;
    if (secondsLeft <= 0) {
      submitSession(session.sessionId, true);
      return;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null || s <= 1) {
          clearInterval(timerRef.current!);
          submitSession(session.sessionId, true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session, secondsLeft, submitSession]);

  // Anti-cheat: fullscreen + tab-switch monitoring (same rules as the main exam).
  // Fullscreen is enforced on desktop only — on touch devices it's unreliable and
  // causes false strikes / forced rotation, so we rely on tab-switch detection.
  const requireFullscreen = useMemo(
    () => typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches,
    [],
  );
  const handleGuardAutoSubmit = useCallback(() => {
    if (session) submitSession(session.sessionId, true);
  }, [session, submitSession]);

  const { strikes, warning, isFullscreen, dismissWarning, requestFullscreen } =
    useExamGuard(session !== null, handleGuardAutoSubmit, { requireFullscreen });

  // Disable copy, cut, and right-click while the exam is open
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

  function fmtTimer(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function selectAnswer(questionId: string, label: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: label };
      // Debounced save
      clearTimeout(savingRef.current[questionId]);
      savingRef.current[questionId] = setTimeout(() => {
        if (!session) return;
        mockFetch(`/api/mock/sessions/${session.sessionId}/answer`, id, {
          method: "POST",
          body: JSON.stringify({ questionId, selected: label }),
        }).catch(() => {});
      }, 300);
      return next;
    });
  }

  async function handleSubmit() {
    if (!session) return;
    const unanswered = session.questions.filter((q) => !answers[q.id]).length;
    if (unanswered > 0) {
      setConfirmSubmitCount(unanswered);
      return;
    }
    await doSubmit();
  }

  async function doSubmit() {
    if (!session) return;
    setConfirmSubmitCount(null);
    setSubmitting(true);
    await submitSession(session.sessionId, false);
  }

  async function handlePanic() {
    if (!session || !panicMessage.trim()) return;
    setPanicking(true);
    try {
      await mockFetch("/api/mock/panic", id, {
        method: "POST",
        body: JSON.stringify({ message: panicMessage.trim(), sessionId: session.sessionId }),
      });
      setPanicSent(true);
      setTimeout(() => { setShowPanicModal(false); setPanicSent(false); setPanicMessage(""); }, 2000);
    } catch {
      // silently fail — the report may or may not have saved
    } finally {
      setPanicking(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Loading your exam…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">⛔</div>
        <h1 className="text-xl font-bold">Can&apos;t start exam</h1>
        <p className="text-slate-400">{error}</p>
        <button onClick={() => router.push(`/mock/${id}`)} className="px-6 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
          Back to exam info
        </button>
      </div>
    </div>
  );

  if (!session) return null;

  const q = session.questions[current];
  const answered = Object.values(answers).filter(Boolean).length;
  const total = session.questions.length;
  const progress = (answered / total) * 100;
  const timerCritical = (secondsLeft ?? 0) < 120;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image src="/images/logo.jpg" alt="Acadmate" width={30} height={30} className="rounded-lg shadow-md object-cover shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Attempt {session.attemptNumber}</p>
              <p className="font-semibold truncate text-sm">{session.examTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {requireFullscreen && !isFullscreen && (
              <button
                onClick={requestFullscreen}
                title="Enter fullscreen"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                Fullscreen
              </button>
            )}
            {strikes > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                ⚠ {strikes}/2
              </span>
            )}
            <div className={`text-2xl font-mono font-bold tabular-nums ${timerCritical ? "text-red-400 animate-pulse" : "text-indigo-300"}`}>
              {secondsLeft !== null ? fmtTimer(secondsLeft) : "--:--"}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="max-w-2xl mx-auto mt-1 text-xs text-slate-500">
          {answered}/{total} answered
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Question nav pills */}
        <div className="flex flex-wrap gap-1.5">
          {session.questions.map((_, i) => {
            const qId = session.questions[i].id;
            const isAnswered = !!answers[qId];
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                  i === current
                    ? "bg-indigo-600 text-white"
                    : isAnswered
                    ? "bg-indigo-900/60 text-indigo-300"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        {q && (
          <div className="flex-1 space-y-4">
            <div className="bg-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600/60 text-xs font-bold flex items-center justify-center text-indigo-200">
                  {current + 1}
                </span>
                <MathText text={q.text} className="leading-relaxed text-white" />
              </div>
              {q.imageUrl && (
                <img src={q.imageUrl} alt="Question image" className="rounded-xl max-h-48 object-contain w-full bg-black/20" />
              )}
            </div>

            <div className="space-y-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.label;
                return (
                  <button
                    key={opt.label}
                    onClick={() => selectAnswer(q.id, opt.label)}
                    className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${
                      selected
                        ? "bg-indigo-600 border-2 border-indigo-400 text-white"
                        : "bg-white/5 border-2 border-transparent hover:bg-white/10 text-slate-200"
                    }`}
                  >
                    <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 ${
                      selected ? "border-white bg-white text-indigo-600" : "border-slate-500 text-slate-400"
                    }`}>
                      {opt.label}
                    </span>
                    <MathText text={opt.text} className="leading-snug" />
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
                className="px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium disabled:opacity-30 hover:bg-white/20 transition-colors"
              >
                ← Previous
              </button>
              {current < total - 1 ? (
                <button
                  onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  {submitting ? "Submitting…" : "Submit Exam"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPanicModal(true)}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              🚨 Report
            </button>
            <button
              onClick={() => setShowCalculator(true)}
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
              Calculator
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit All"}
          </button>
        </div>
      </div>

      {/* Calculator */}
      {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

      {/* Panic modal */}
      {showPanicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1e293b] rounded-2xl p-6 w-full max-w-sm space-y-4">
            {panicSent ? (
              <div className="text-center space-y-3">
                <div className="text-4xl">✅</div>
                <p className="font-semibold">Report sent to admin!</p>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-lg">Report an Issue</h3>
                <p className="text-sm text-slate-400">Describe the problem you're facing. An admin will be alerted.</p>
                <textarea
                  rows={3}
                  value={panicMessage}
                  onChange={(e) => setPanicMessage(e.target.value)}
                  placeholder="e.g. My screen froze, I can't proceed to next question…"
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowPanicModal(false); setPanicMessage(""); }}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePanic}
                    disabled={panicking || !panicMessage.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                  >
                    {panicking ? "Sending…" : "Send Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Strike warning modal */}
      {warning && <StrikeWarningModal warning={warning} onDismiss={dismissWarning} />}

      <ConfirmModal
        open={confirmSubmitCount !== null}
        title="Submit exam?"
        message={`You have ${confirmSubmitCount} unanswered question${confirmSubmitCount === 1 ? "" : "s"}. Submit anyway?`}
        confirmLabel="Submit anyway"
        tone="danger"
        loading={submitting}
        onConfirm={doSubmit}
        onCancel={() => setConfirmSubmitCount(null)}
      />
    </div>
  );
}

function StrikeWarningModal({
  warning,
  onDismiss,
}: {
  warning: StrikeWarning;
  onDismiss: () => void;
}) {
  const { type, strike, isFinal } = warning;
  const reason = type === "tab" ? "You switched to another tab or window" : "You exited fullscreen mode";

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1e293b] rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        <div className={`h-1.5 w-full ${isFinal ? "bg-red-600" : "bg-amber-500"}`} />
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isFinal ? "bg-red-500/20" : "bg-amber-500/20"}`}>
              <span className="text-2xl">{isFinal ? "⛔" : "⚠️"}</span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">
                {isFinal ? "Exam Auto-Submitted" : `Strike ${strike} of 2`}
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">{reason}</p>
            </div>
          </div>
          <div className={`rounded-xl p-4 text-sm ${isFinal ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
            {isFinal
              ? "You have used both strikes. Your exam is being submitted now — you'll be redirected to your results shortly."
              : "This is a monitored exam. One more violation will automatically submit your exam."}
          </div>
          {!isFinal && (
            <button
              onClick={onDismiss}
              className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              I understand — return to exam
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
