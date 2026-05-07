"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchPostUtmeQuestions, createPostUtmeExam } from "@/features/post-utme/api";
import { SCHOOLS, DEFAULT_QUESTION_COUNT } from "@/features/post-utme/constants";
import { ApiError } from "@/lib/api/client";
import type { YearPack } from "@/features/post-utme/types";
import Loader from "@/app/components/Loader";

// ─── Year pack card ────────────────────────────────────────────────────────────

function PackCard({
  pack,
  selected,
  onSelect,
}: {
  pack: YearPack | null; // null = "All Years"
  selected: boolean;
  onSelect: () => void;
}) {
  const isAll = pack === null;
  return (
    <button
      onClick={onSelect}
      className={`p-5 rounded-2xl border-2 text-left transition-all ${
        selected
          ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20"
          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/50 dark:bg-black/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-bold text-base text-slate-800 dark:text-slate-100">
            {isAll ? "All Years" : `${pack!.year}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAll ? "Mixed questions across all years" : `${pack!.questionCount} question${pack!.questionCount !== 1 ? "s" : ""} available`}
          </div>
        </div>
        {selected && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      {!isAll && (
        <div className="flex gap-1 flex-wrap mt-3">
          <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Past paper
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PacksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const schoolId = searchParams.get("school") ?? "";
  const school = SCHOOLS.find((s) => s.id === schoolId);

  const [packs, setPacks] = useState<YearPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // null = all years selected
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // ── Redirect if school param is missing or invalid ───────────────────────
  useEffect(() => {
    if (!school) {
      router.replace("/exam/post-utme/schools");
    }
  }, [school, router]);

  // ── Fetch questions and extract year packs ────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    setFetchError("");

    fetchPostUtmeQuestions(schoolId)
      .then(({ questions }) => {
        // Aggregate question counts per year
        const yearMap = new Map<number, number>();
        for (const q of questions) {
          if (q.year != null) {
            yearMap.set(q.year, (yearMap.get(q.year) ?? 0) + 1);
          }
        }

        const sorted: YearPack[] = Array.from(yearMap.entries())
          .map(([year, questionCount]) => ({ year, questionCount }))
          .sort((a, b) => b.year - a.year); // newest first

        setPacks(sorted);
      })
      .catch((err) => {
        setFetchError(
          err instanceof ApiError ? err.message : "Failed to load packs. Please try again."
        );
      })
      .finally(() => setLoading(false));
  }, [schoolId]);

  async function handleStart() {
    if (!school) return;
    setStartError("");
    setStarting(true);

    try {
      const { examSession } = await createPostUtmeExam({
        school: school.id,
        ...(selectedYear != null && { year: selectedYear }),
        questionCount,
      });
      router.push(`/exam/${examSession.id}`);
    } catch (err) {
      setStartError(
        err instanceof ApiError ? err.message : "Failed to start exam. Please try again."
      );
      setStarting(false);
    }
  }

  if (!school) return null; // redirect in-flight

  const totalAvailable = packs.reduce((n, p) => n + p.questionCount, 0);
  const cappedMax = Math.min(
    selectedYear != null
      ? (packs.find((p) => p.year === selectedYear)?.questionCount ?? DEFAULT_QUESTION_COUNT)
      : totalAvailable,
    100
  );
  const startDisabled = starting || (loading && packs.length === 0) || (!loading && packs.length === 0 && selectedYear != null);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/exam/new" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Start Exam
        </Link>
        <span>/</span>
        <Link href="/exam/post-utme/schools" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Post-UTME
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium">{school.abbr}</span>
        <span>/</span>
        <span className="text-indigo-600 dark:text-indigo-400 font-medium">Select Pack</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
            {school.abbr.slice(0, 3)}
          </span>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{school.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            Post-UTME · {school.location}
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Year packs */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="font-semibold text-lg">Choose a Pack</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Practice with a specific year's paper or mix questions from all years.
            </p>
          </div>

          {loading ? (
            <Loader className="py-4" />
          ) : fetchError ? (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {fetchError}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* All Years option — always shown */}
              <PackCard
                pack={null}
                selected={selectedYear === null}
                onSelect={() => setSelectedYear(null)}
              />
              {packs.length === 0 ? (
                <div className="col-span-full text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                  No past papers found for {school.name} yet. Check back soon.
                </div>
              ) : (
                packs.map((p) => (
                  <PackCard
                    key={p.year}
                    pack={p}
                    selected={selectedYear === p.year}
                    onSelect={() => setSelectedYear(p.year)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Question count slider */}
        {!loading && !fetchError && (
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h2 className="font-semibold text-lg">Number of Questions</h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={10}
                max={Math.max(cappedMax, 10)}
                step={5}
                value={Math.min(questionCount, Math.max(cappedMax, 10))}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="w-12 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                {Math.min(questionCount, Math.max(cappedMax, 10))}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ~{Math.min(questionCount, Math.max(cappedMax, 10)) * 2} minutes
              {selectedYear != null && packs.find((p) => p.year === selectedYear) && (
                <> · {packs.find((p) => p.year === selectedYear)!.questionCount} questions available for {selectedYear}</>
              )}
            </p>
          </div>
        )}

        {/* Start error */}
        {startError && (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {startError}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={startDisabled}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {starting ? (
            "Starting exam…"
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start {selectedYear != null ? `${selectedYear} ` : ""}Post-UTME
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function PostUtmePacksPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
      <PacksContent />
    </Suspense>
  );
}
