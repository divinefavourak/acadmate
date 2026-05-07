"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { SCHOOLS } from "@/features/post-utme/constants";
import type { School } from "@/features/post-utme/types";

// ─── School Card ─────────────────────────────────────────────────────────────

function SchoolCard({ school, onSelect }: { school: School; onSelect: (s: School) => void }) {
  return (
    <button
      onClick={() => onSelect(school)}
      className="glass-panel p-5 rounded-2xl text-left hover:border-indigo-400 dark:hover:border-indigo-600 border-2 border-transparent transition-all group"
    >
      {/* Abbreviation avatar */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm tracking-tight">
            {school.abbr.slice(0, 3)}
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {school.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{school.location}</div>
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
          className="ml-auto flex-shrink-0 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500 transition-colors"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>

      <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Post-UTME
      </div>
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PostUtmeSchoolsPage() {
  const router = useRouter();

  function handleSelect(school: School) {
    router.push(`/exam/post-utme/packs?school=${encodeURIComponent(school.id)}`);
  }

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

      <div className="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SCHOOLS.map((school) => (
            <SchoolCard key={school.id} school={school} onSelect={handleSelect} />
          ))}
        </div>

        <p className="mt-8 text-xs text-slate-400 dark:text-slate-600 text-center">
          More schools being added regularly. Questions sourced from official past papers.
        </p>
      </div>
    </div>
  );
}
