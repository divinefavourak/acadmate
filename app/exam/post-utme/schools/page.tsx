"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { SCHOOLS } from "@/features/post-utme/constants";
import Folder from "@/app/admin/components/Folder";

const SCHOOL_COLORS = [
  "#16A34A", "#2563EB", "#7C3AED", "#DC2626",
  "#D97706", "#0891B2",
];

export default function PostUtmeSchoolsPage() {
  const router = useRouter();

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
        {SCHOOLS.map((school, i) => (
          <button
            key={school.id}
            onClick={() => router.push(`/exam/post-utme/packs?school=${encodeURIComponent(school.id)}`)}
            className="flex flex-col items-center gap-3 group focus:outline-none"
          >
            <Folder color={SCHOOL_COLORS[i % SCHOOL_COLORS.length]} size={1.2} />
            <div className="text-center">
              <p className="font-bold text-sm group-hover:text-indigo-400 dark:group-hover:text-indigo-400 transition-colors">
                {school.abbr}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                {school.location}
              </p>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-600">
        More schools being added regularly. Questions sourced from official past papers.
      </p>
    </div>
  );
}
