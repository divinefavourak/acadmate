"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchPostUtmeQuestions, createPostUtmeExam } from "@/features/post-utme/api";
import { SCHOOLS, DEFAULT_QUESTION_COUNT } from "@/features/post-utme/constants";
import { ApiError } from "@/lib/api/client";
import type { YearPack } from "@/features/post-utme/types";
import Loader from "@/app/components/Loader";
import Folder from "@/app/admin/components/Folder";

const PACK_COLORS = [
  "#4F46E5", "#7C3AED", "#2563EB", "#0891B2",
  "#059669", "#65A30D", "#D97706", "#DC2626",
];

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
          ) : packs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
              No past papers found for {school.name} yet. Check back soon.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {/* All Years option */}
              <button
                onClick={() => setSelectedYear(null)}
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <Folder
                  color="#6366F1"
                  size={1.05}
                  open={selectedYear === null}
                  onToggle={() => setSelectedYear(null)}
                />
                <span className={`text-xs font-medium text-center leading-tight transition-colors ${
                  selectedYear === null ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                }`}>
                  All Years
                </span>
              </button>
              {packs.map((p, i) => (
                <button
                  key={p.year}
                  onClick={() => setSelectedYear(p.year)}
                  className="flex flex-col items-center gap-2 group focus:outline-none"
                >
                  <Folder
                    color={PACK_COLORS[i % PACK_COLORS.length]}
                    size={1.05}
                    open={selectedYear === p.year}
                    onToggle={() => setSelectedYear(p.year)}
                  />
                  <span className={`text-xs font-medium text-center leading-tight transition-colors ${
                    selectedYear === p.year ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                  }`}>
                    {p.year}
                  </span>
                </button>
              ))}
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
    <Suspense fallback={<Loader className="h-96" />}>
      <PacksContent />
    </Suspense>
  );
}
