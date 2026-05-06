"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import MathText from "@/app/components/MathText";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionAnswer {
  questionId: string;
  optionId: string | null;
  isCorrect: boolean | null;
  question: {
    id: string;
    text: string;
    subject: { id: string; name: string };
    topic: { id: string; name: string } | null;
    options: Option[];
    explanation: { text: string } | null;
  };
}

interface SubjectBreakdown {
  [subjectId: string]: { name: string; correct: number; total: number };
}

interface TopicBreakdown {
  [topicId: string]: { name: string; correct: number; total: number };
}

interface ResultDetail {
  id: string;
  score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  totalQuestions: number;
  subjectBreakdown: SubjectBreakdown;
  topicBreakdown: TopicBreakdown;
  createdAt: string;
  examSession: {
    id: string;
    mode: string;
    status: string;
    durationMinutes: number;
    startedAt: string;
    submittedAt: string | null;
    userAnswers: QuestionAnswer[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function modeLabel(mode: string) {
  if (mode === "MOCK") return "Full UTME Mock";
  if (mode === "PRACTICE") return "Practice Session";
  if (mode === "TOPIC") return "Topic Practice";
  return mode;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function ScoreBar({ val, color = "bg-indigo-500" }: { val: number; color?: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${val}%` }} />
    </div>
  );
}

// ─── Question Card ───────────────────────────────────────────────────────────

function QuestionCard({ qa, index }: { qa: QuestionAnswer; index: number }) {
  const [open, setOpen] = useState(false);
  const statusIcon = qa.isCorrect === true ? "✅" : qa.isCorrect === false ? "❌" : "⬜";
  const statusLabel = qa.isCorrect === true ? "Correct" : qa.isCorrect === false ? "Incorrect" : "Unanswered";
  const statusColor =
    qa.isCorrect === true
      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
      : qa.isCorrect === false
      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800";

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${statusColor}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-4 p-5 text-left"
      >
        <span className="text-xl flex-shrink-0">{statusIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Q{index + 1} · {qa.question.subject.name}
              {qa.question.topic ? ` · ${qa.question.topic.name}` : ""}
            </span>
            <span
              className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                qa.isCorrect === true
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : qa.isCorrect === false
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2"><MathText text={qa.question.text} /></p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-shrink-0 mt-1 transition-transform text-slate-400 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-inherit">
          {/* Full question text */}
          <p className="pt-4 text-slate-800 dark:text-slate-100 font-medium leading-relaxed"><MathText text={qa.question.text} /></p>

          {/* Options */}
          <div className="space-y-2">
            {qa.question.options.map((opt) => {
              const isStudentAnswer = qa.optionId === opt.id;
              const isCorrectOpt = opt.isCorrect;
              let cls = "flex items-center gap-3 p-3 rounded-xl border text-sm transition-all ";
              if (isCorrectOpt) {
                cls += "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200";
              } else if (isStudentAnswer && !isCorrectOpt) {
                cls += "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200";
              } else {
                cls += "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400";
              }
              return (
                <div key={opt.id} className={cls}>
                  <span
                    className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs ${
                      isCorrectOpt
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isStudentAnswer
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="flex-1"><MathText text={opt.text} /></span>
                  {isCorrectOpt && <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">✓ Correct</span>}
                  {isStudentAnswer && !isCorrectOpt && <span className="text-red-600 dark:text-red-400 font-semibold text-xs">Your answer</span>}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {qa.question.explanation && (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
                💡 Explanation
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <MathText text={qa.question.explanation.text} />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const timedOut = searchParams.get("timeout") === "1";

  const [result, setResult] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect" | "unanswered">("all");

  useEffect(() => {
    apiClient<ResultDetail & {
      subjectBreakdowns?: { subjectId: string; name: string; correct: number; total: number }[];
      topicBreakdowns?: { topicId: string; name: string; correct: number; total: number }[];
    }>(`/results/${id}`)
      .then((raw) => {
        // Normalise array → keyed-object shape the page expects
        const subjectBreakdown: SubjectBreakdown = {};
        for (const s of raw.subjectBreakdowns ?? []) {
          subjectBreakdown[s.subjectId] = { name: s.name, correct: s.correct, total: s.total };
        }
        const topicBreakdown: TopicBreakdown = {};
        for (const t of raw.topicBreakdowns ?? []) {
          topicBreakdown[t.topicId] = { name: t.name, correct: t.correct, total: t.total };
        }
        setResult({ ...raw, subjectBreakdown, topicBreakdown });
      })
      .catch(() => setError("Failed to load result."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Loader className="h-screen" />
    );
  }

  if (error || !result) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-red-500">{error || "Result not found."}</div>
      </div>
    );
  }

  const subjectEntries = Object.values(result.subjectBreakdown as SubjectBreakdown);
  const topicEntries = Object.values(result.topicBreakdown as TopicBreakdown)
    .sort((a, b) => (a.correct / a.total) - (b.correct / b.total))
    .slice(0, 5);

  const answers = result.examSession.userAnswers;
  const filteredAnswers = answers.filter((qa) => {
    if (filter === "correct") return qa.isCorrect === true;
    if (filter === "incorrect") return qa.isCorrect === false;
    if (filter === "unanswered") return qa.isCorrect === null;
    return true;
  });

  const pct = Math.round(result.score);

  return (
    <div className="space-y-8">
      {/* Timeout banner */}
      {timedOut && (
        <div className="px-5 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm font-medium">
          ⏱️ Your exam was auto-submitted because time ran out.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Exam Result</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {modeLabel(result.examSession.mode)} ·{" "}
            {new Date(result.createdAt).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <Link href="/results" className="btn-secondary text-sm px-5 py-2">← Back to My Exams</Link>
      </div>

      {/* Score hero */}
      <div className="glass-panel p-8 rounded-3xl flex flex-col md:flex-row items-center gap-8">
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className={`text-7xl font-extrabold ${scoreColor(pct)}`}>{pct}%</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Overall Score</div>
        </div>
        <div className="flex-1 w-full grid grid-cols-3 gap-4">
          {[
            { label: "Correct", value: result.correct, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500" },
            { label: "Incorrect", value: result.incorrect, color: "text-red-600 dark:text-red-400", bg: "bg-red-500" },
            { label: "Unanswered", value: result.unanswered, color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-400" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="text-center">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">{label}</div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${bg} rounded-full`}
                  style={{ width: `${(value / result.totalQuestions) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject breakdown */}
        <div className="glass-panel p-6 rounded-2xl space-y-5">
          <h2 className="text-xl font-bold">Subject Breakdown</h2>
          {subjectEntries.length === 0 ? (
            <p className="text-slate-500 text-sm">No subject data available.</p>
          ) : (
            subjectEntries.map((s) => {
              const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              return (
                <div key={s.name}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className={`text-sm font-bold ${pct >= 70 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-red-500"}`}>
                      {pct}%
                    </span>
                  </div>
                  <ScoreBar
                    val={pct}
                    color={pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}
                  />
                  <p className="text-xs text-slate-500 mt-1">{s.correct}/{s.total} correct</p>
                </div>
              );
            })
          )}
        </div>

        {/* Weak topics */}
        <div className="glass-panel p-6 rounded-2xl space-y-5">
          <h2 className="text-xl font-bold">Topics to Improve</h2>
          {topicEntries.length === 0 ? (
            <p className="text-slate-500 text-sm">No topic data available.</p>
          ) : (
            topicEntries.map((t) => {
              const pct = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
              return (
                <div key={t.name}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-sm font-bold text-red-500">{pct}%</span>
                  </div>
                  <ScoreBar val={pct} color="bg-red-400" />
                  <p className="text-xs text-slate-500 mt-1">{t.correct}/{t.total} correct</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Per-question review */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Question Review</h2>
          <div className="flex gap-2 flex-wrap">
            {(["all", "correct", "incorrect", "unanswered"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === f
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {f === "all" ? `All (${answers.length})` : f === "correct" ? `✅ Correct (${result.correct})` : f === "incorrect" ? `❌ Incorrect (${result.incorrect})` : `⬜ Skipped (${result.unanswered})`}
              </button>
            ))}
          </div>
        </div>

        {filteredAnswers.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No questions match this filter.</p>
        ) : (
          <div className="space-y-3">
            {filteredAnswers.map((qa, i) => (
              <QuestionCard key={qa.questionId} qa={qa} index={answers.indexOf(qa)} />
            ))}
          </div>
        )}
      </div>

      {/* Start new exam CTA */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg">Ready for another round?</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Keep practicing to improve your score.</p>
        </div>
        <Link href="/exam/new" className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start New Exam
        </Link>
      </div>
    </div>
  );
}
