"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SCHOOLS } from "@/features/post-utme/constants";
import { schoolHasQuestions } from "@/features/post-utme/api";
import Folder from "@/app/admin/components/Folder";

const SCHOOL_COLORS = [
  "#16A34A", "#2563EB", "#7C3AED", "#DC2626",
  "#D97706", "#0891B2",
];

export default function PostUtmeSchoolsPage() {
  const router = useRouter();
  const [available, setAvailable] = useState<Record<string, boolean | null>>(
    () => Object.fromEntries(SCHOOLS.map((s) => [s.id, null]))
  );

  useEffect(() => {
    Promise.all(
      SCHOOLS.map((s) =>
        schoolHasQuestions(s.id)
          .then((has) => [s.id, has] as const)
          .catch(() => [s.id, false] as const)
      )
    ).then((results) =>
      setAvailable(Object.fromEntries(results))
    );
  }, []);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/exam/new" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Start Exam
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium">Post-UTME</span>
        <span>/</span>
        <span className="text-indigo-600 dark:text-indigo-400 font-medium">Select School</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Select Your School</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Choose the institution whose Post-UTME questions you want to practice.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-2xl">
        {SCHOOLS.map((school, i) => {
          const status = available[school.id]; // null=loading, true=ready, false=coming soon
          const isReady = status === true;
          const isLoading = status === null;

          return (
            <button
              key={school.id}
              onClick={() => isReady && router.push(`/exam/post-utme/packs?school=${encodeURIComponent(school.id)}`)}
              disabled={!isReady}
              className={`flex flex-col items-center gap-3 group focus:outline-none transition-opacity ${
                isLoading ? "opacity-60" : !isReady ? "opacity-40 cursor-not-allowed" : ""
              }`}
            >
              <Folder color={SCHOOL_COLORS[i % SCHOOL_COLORS.length]} size={1.2} />
              <div className="text-center">
                <p className={`font-bold text-sm transition-colors ${
                  isReady ? "group-hover:text-indigo-400 dark:group-hover:text-indigo-400" : ""
                }`}>
                  {school.abbr}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                  {school.location}
                </p>
                {status === false && (
                  <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Coming soon
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-600">
        More schools being added regularly. Questions sourced from official past papers.
      </p>
    </div>
  );
}
