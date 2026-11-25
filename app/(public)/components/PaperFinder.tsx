"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { subjectPath, yearPath } from "@/lib/pastQuestions";

export interface FinderSubject {
  slug: string;
  name: string;
  years: number[];
}

const selectClass =
  "w-full appearance-none rounded-lg border-0 bg-white py-3 pl-3.5 pr-9 text-base font-semibold text-slate-900 shadow-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-mint-400 disabled:text-slate-400";

/**
 * "Pick a paper": subject, then year, then straight to that paper's questions.
 * With a subject but no year it opens the subject page instead.
 */
export function PaperFinder({ subjects }: { subjects: FinderSubject[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [year, setYear] = useState("");
  const subject = subjects.find((s) => s.slug === slug);

  function open(e: React.FormEvent) {
    e.preventDefault();
    if (!subject) return;
    router.push(year ? yearPath(subject.slug, Number(year)) : subjectPath(subject.slug));
  }

  return (
    <form onSubmit={open} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm sm:p-4">
      <p className="px-1 pb-3 font-semibold text-white">Pick a past paper</p>
      <div className="grid gap-2.5 sm:grid-cols-[1.3fr_1fr_auto]">
        <label className="relative">
          <span className="sr-only">Subject</span>
          <select
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setYear("");
            }}
            className={selectClass}
          >
            <option value="">Subject</option>
            {subjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <Chevron />
        </label>
        <label className="relative">
          <span className="sr-only">Year</span>
          <select value={year} onChange={(e) => setYear(e.target.value)} disabled={!subject} className={selectClass}>
            <option value="">{subject ? "Any year" : "Year"}</option>
            {subject?.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Chevron />
        </label>
        <button
          type="submit"
          disabled={!subject}
          className="rounded-lg bg-mint-400 px-5 py-3 font-bold text-navy-900 transition-colors hover:bg-mint-300 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Get questions
        </button>
      </div>
    </form>
  );
}

function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" width="18" height="18" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
    </svg>
  );
}
