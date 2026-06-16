"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", path: "" },
  { label: "Participants", path: "/participants" },
  { label: "Questions", path: "/questions" },
  { label: "Results", path: "/results" },
  { label: "Panics", path: "/panics" },
];

export default function MockExamLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-slate-200 dark:border-slate-800 pb-0">
        {TABS.map((tab) => {
          const href = `/admin/mock/${id}${tab.path}`;
          const active = tab.path === ""
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link key={tab.path} href={href}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                active
                  ? "border-indigo-500 text-indigo-700 dark:text-indigo-300"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
