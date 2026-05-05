"use client";

import { useEffect, useState } from "react";
import MathText from "@/app/components/MathText";
import { apiClient } from "@/lib/api/client";

interface FlagEntry {
  id: string;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  question: {
    id: string;
    text: string;
    isFlagged: boolean;
    year: number | null;
    subject: { name: string };
    topic: { name: string } | null;
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MyFlagsPage() {
  const [flags, setFlags] = useState<FlagEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<{ flags: FlagEntry[] }>("/flags")
      .then((data) => setFlags(data.flags ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const resolved = flags.filter((f) => f.resolved);
  const pending = flags.filter((f) => !f.resolved);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Reported Questions</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Questions you flagged during exams. We review all reports and fix issues as quickly as possible.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm py-16 text-center">Loading…</p>
      ) : flags.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-2">
          <p className="text-2xl">🚩</p>
          <p className="font-semibold">No reported questions</p>
          <p className="text-sm text-slate-500">If you spot a bad question during an exam, hit Report and we'll look into it.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Under Review
                <span className="text-xs font-normal text-slate-500">({pending.length})</span>
              </h2>
              <div className="space-y-3">
                {pending.map((f) => (
                  <FlagCard key={f.id} flag={f} />
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Resolved
                <span className="text-xs font-normal text-slate-500">({resolved.length})</span>
              </h2>
              <div className="space-y-3">
                {resolved.map((f) => (
                  <FlagCard key={f.id} flag={f} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function FlagCard({ flag }: { flag: FlagEntry }) {
  const { question, resolved, resolvedAt, createdAt } = flag;
  return (
    <div className={`p-4 rounded-xl border ${
      resolved
        ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10"
        : "border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            {question.subject.name}
          </span>
          {question.topic && (
            <span className="text-xs text-slate-500">{question.topic.name}</span>
          )}
          {question.year && (
            <span className="text-xs text-slate-500">{question.year}</span>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          resolved
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
        }`}>
          {resolved ? "✓ Resolved" : "⏳ Under Review"}
        </span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 mb-2">
        <MathText text={question.text} />
      </p>
      <p className="text-xs text-slate-400">
        Reported {formatDate(createdAt)}
        {resolved && resolvedAt && ` · Resolved ${formatDate(resolvedAt)}`}
      </p>
    </div>
  );
}
