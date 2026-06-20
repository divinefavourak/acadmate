"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import MathText from "@/app/components/MathText";

interface SubjectStat { correct: number; total: number }
interface ReviewAnswer {
  questionId: string;
  text: string;
  subject: string;
  options: { label: string; text: string }[];
  selected: string | null;
  correctLabel: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
}

interface SessionResult {
  sessionId: string;
  attemptNumber: number;
  status: string;
  score: number | null;
  correct: number | null;
  total: number | null;
  timeTakenSeconds: number | null;
  participant: { name: string | null; phone: string };
  examTitle: string;
  subjectBreakdown: Record<string, SubjectStat>;
  answers: ReviewAnswer[];
}

function fmtTime(sec: number | null) {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export default function MockResultPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const router = useRouter();
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(`mock_token_${id}`) : null;
    apiClient<SessionResult>(`/api/mock/sessions/${sessionId}/result`, {
      skipAuth: true,
      on401: "throw",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(setResult)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/mock/${id}/login`);
        } else {
          setError("Failed to load result. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [id, sessionId, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !result) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6 text-center">
      <div className="space-y-4">
        <p className="text-red-400">{error || "Result not found"}</p>
        <Link href={`/mock/${id}`} className="text-indigo-400 hover:underline">Back to exam</Link>
      </div>
    </div>
  );

  const pct = result.score?.toFixed(1) ?? "0.0";
  const passed = (result.score ?? 0) >= 50;
  const subjects = Object.entries(result.subjectBreakdown);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Score hero */}
        <div className="text-center space-y-4 py-8">
          <div className="text-7xl font-black tabular-nums" style={{ color: passed ? "#4ade80" : "#f87171" }}>
            {pct}%
          </div>
          <p className="text-2xl font-bold">{passed ? "Great job!" : "Keep practising!"}</p>
          <p className="text-slate-400">
            {result.correct ?? 0} correct out of {result.total ?? 0} questions · {fmtTime(result.timeTakenSeconds)}
          </p>
          {result.status === "TIMED_OUT" && (
            <p className="text-amber-400 text-sm">Session ended due to time expiry</p>
          )}
        </div>

        {/* Subject breakdown */}
        {subjects.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-sm text-slate-300 uppercase tracking-wider">Subject Breakdown</h3>
            {subjects.map(([subj, stat]) => {
              const pctSubj = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
              return (
                <div key={subj} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{subj}</span>
                    <span className="font-semibold">{stat.correct}/{stat.total}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pctSubj}%`, background: pctSubj >= 50 ? "#4ade80" : "#f87171" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link href={`/mock/${id}/leaderboard`}
            className="block w-full py-3 text-center rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
            View Leaderboard
          </Link>
          <button
            onClick={() => setShowReview(!showReview)}
            className="w-full py-3 text-center rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            {showReview ? "Hide" : "Review Answers"}
          </button>
          <Link href={`/mock/${id}`}
            className="block text-center text-sm text-slate-400 hover:text-slate-200 transition-colors">
            ← Back to exam info
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem(`mock_token_${id}`);
              router.replace(`/mock/${id}`);
            }}
            className="block w-full text-center text-sm text-slate-500 hover:text-red-400 transition-colors"
          >
            Log out
          </button>
        </div>

        {/* Answer review */}
        {showReview && (
          <div className="space-y-4">
            <h3 className="font-semibold">Answer Review</h3>
            {result.answers.map((a, i) => (
              <div key={a.questionId} className="bg-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 text-xs font-bold mt-0.5 px-2 py-0.5 rounded-full ${
                    a.isCorrect === true ? "bg-emerald-900/50 text-emerald-300" :
                    a.isCorrect === false ? "bg-red-900/50 text-red-300" : "bg-white/10 text-slate-400"
                  }`}>
                    Q{i + 1}
                  </span>
                  <MathText text={a.text} className="text-sm leading-relaxed" />
                </div>
                <div className="space-y-1">
                  {a.options.map((opt) => {
                    const isCorrect = opt.label === a.correctLabel;
                    const isSelected = opt.label === a.selected;
                    return (
                      <div key={opt.label} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${
                        isCorrect ? "bg-emerald-900/30 text-emerald-300" :
                        isSelected && !isCorrect ? "bg-red-900/30 text-red-300" : "text-slate-400"
                      }`}>
                        <span className="font-bold shrink-0 w-4">{opt.label}.</span>
                        <MathText text={opt.text} />
                        {isSelected && !isCorrect && <span className="ml-auto shrink-0">✗ Your answer</span>}
                        {isCorrect && <span className="ml-auto shrink-0">✓ Correct</span>}
                      </div>
                    );
                  })}
                </div>
                {a.explanation && (
                  <MathText text={a.explanation} className="block text-xs text-slate-400 border-t border-white/10 pt-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
