"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";

interface ExamInfo {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  questionCount: number;
}

function useCountdown(target: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = Math.floor((new Date(target).getTime() - Date.now()) / 1000);
      setRemaining(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

function fmtCountdown(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MockLandingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [error, setError] = useState("");
  const [hasToken, setHasToken] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  const countdown = useCountdown(exam ? exam.startsAt : null);
  const endCountdown = useCountdown(exam ? exam.endsAt : null);
  const isLive = exam ? new Date(exam.startsAt).getTime() <= now && new Date(exam.endsAt).getTime() > now : false;
  const isOver = exam ? new Date(exam.endsAt).getTime() <= now : false;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(`mock_token_${id}`);
    setHasToken(!!token);
    apiClient<ExamInfo>(`/api/mock/${id}/info`, { skipAuth: true })
      .then(setExam)
      .catch(() => setError("Exam not found or is not currently active."));
  }, [id]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-6xl">😕</div>
        <h1 className="text-2xl font-bold">Exam not available</h1>
        <p className="text-slate-400">{error}</p>
      </div>
    </div>
  );

  if (!exam) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="text-5xl">📝</div>
          <h1 className="text-3xl font-bold">{exam.title}</h1>
          {exam.description && <p className="text-slate-400">{exam.description}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Questions", value: exam.questionCount },
            { label: "Duration", value: `${exam.durationMinutes} min` },
            { label: "Max Attempts", value: "2" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-300">{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Time info */}
        <div className="bg-white/5 rounded-2xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Starts</span><span className="font-medium">{fmt(exam.startsAt)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Ends</span><span className="font-medium">{fmt(exam.endsAt)}</span>
          </div>
        </div>

        {/* Status / countdown */}
        <div className="text-center">
          {isOver ? (
            <div className="text-slate-400">This exam has ended.</div>
          ) : isLive ? (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Exam is LIVE
              </div>
              {endCountdown !== null && (
                <p className="text-sm text-slate-400">Closes in {fmtCountdown(endCountdown)}</p>
              )}
            </div>
          ) : (
            countdown !== null && (
              <div className="space-y-1">
                <p className="text-sm text-slate-400 uppercase tracking-wider">Starts in</p>
                <div className="text-4xl font-mono font-bold text-indigo-300">{fmtCountdown(countdown)}</div>
              </div>
            )
          )}
        </div>

        {/* CTAs */}
        {!isOver && (
          <div className="space-y-3">
            {hasToken ? (
              <button
                onClick={() => router.push(`/mock/${id}/exam`)}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-colors"
              >
                Enter Exam
              </button>
            ) : (
              <>
                <Link href={`/mock/${id}/login`}
                  className="block w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-center text-lg transition-colors">
                  Log In
                </Link>
                <Link href={`/mock/${id}/register`}
                  className="block w-full py-3 rounded-2xl border border-white/20 hover:bg-white/10 text-white font-medium text-center transition-colors">
                  Register (first time)
                </Link>
              </>
            )}
            <Link href={`/mock/${id}/leaderboard`}
              className="block text-center text-sm text-slate-400 hover:text-slate-200 transition-colors">
              View Leaderboard →
            </Link>
          </div>
        )}

        {isOver && (
          <Link href={`/mock/${id}/leaderboard`}
            className="block w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium text-center transition-colors">
            View Final Leaderboard
          </Link>
        )}
      </div>
    </div>
  );
}
