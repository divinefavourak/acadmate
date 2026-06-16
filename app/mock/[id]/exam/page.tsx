"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";

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

function mockFetch<T>(path: string, examId: string, init?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem(`mock_token_${examId}`) : null;
  return apiClient<T>(path, {
    ...(init ?? {}),
    skipAuth: true,
    on401: "throw",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const submitSession = useCallback(async (sessionId: string, timedOut = false) => {
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

    mockFetch<SessionData>("/api/mock/sessions", id, { method: "POST" })
      .then((data) => {
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
      if (!window.confirm(`You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Submit anyway?`)) return;
    }
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
        <h1 className="text-xl font-bold">Can't start exam</h1>
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
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Attempt {session.attemptNumber}</p>
            <p className="font-semibold truncate text-sm">{session.examTitle}</p>
          </div>
          <div className={`text-2xl font-mono font-bold tabular-nums shrink-0 ${timerCritical ? "text-red-400 animate-pulse" : "text-indigo-300"}`}>
            {secondsLeft !== null ? fmtTimer(secondsLeft) : "--:--"}
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
                <p className="leading-relaxed text-white">{q.text}</p>
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
                    <span className="leading-snug">{opt.text}</span>
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
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={() => setShowPanicModal(true)}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            🚨 Report Issue
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit All"}
          </button>
        </div>
      </div>

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
    </div>
  );
}
