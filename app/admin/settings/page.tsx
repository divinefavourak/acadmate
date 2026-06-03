"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

interface ExamAvailability {
  utme: boolean;
  postUtme: boolean;
}

type GroupKey = keyof ExamAvailability;

const GROUPS: {
  key: GroupKey;
  title: string;
  covers: string;
  description: string;
}[] = [
  {
    key: "utme",
    title: "UTME Exams",
    covers: "Full UTME Mock · Subject Practice · Topic Drill",
    description:
      "Everything that draws from the general question bank. Turn off during Post-UTME season to steer students to past papers.",
  },
  {
    key: "postUtme",
    title: "Post-UTME Exams",
    covers: "Institution past papers",
    description:
      "School-specific Post-UTME papers. Turn off when the Post-UTME window has closed.",
  },
];

export default function ExamSettingsPage() {
  const [availability, setAvailability] = useState<ExamAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<GroupKey | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<ExamAvailability>("/api/admin/settings/exam-availability")
      .then(setAvailability)
      .catch(() => setError("Failed to load exam settings."))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: GroupKey) {
    if (!availability) return;
    const next = !availability[key];
    // Optimistic flip — reverted if the request fails.
    setAvailability({ ...availability, [key]: next });
    setSavingKey(key);
    setError("");
    try {
      const updated = await apiClient<ExamAvailability>(
        "/api/admin/settings/exam-availability",
        { method: "PATCH", body: JSON.stringify({ [key]: next }) },
      );
      setAvailability(updated);
    } catch (err) {
      setAvailability((prev) => (prev ? { ...prev, [key]: !next } : prev));
      setError(err instanceof ApiError ? err.message : "Failed to save. Try again.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Exam Availability</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Switch whole exam groups on or off. When a group is off, students can&apos;t
          start those exams and the type is greyed out in their exam picker.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading || !availability ? (
        <Loader className="py-4" />
      ) : (
        <div className="space-y-4">
          {GROUPS.map(({ key, title, covers, description }) => {
            const on = availability[key];
            const saving = savingKey === key;
            return (
              <div
                key={key}
                className="glass-panel p-5 rounded-2xl flex items-start gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-lg">{title}</h2>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        on
                          ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                          : "bg-slate-500/15 text-slate-400 border border-slate-500/30"
                      }`}
                    >
                      {on ? "Open" : "Off"}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-400 mb-1.5">{covers}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>

                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={`Toggle ${title}`}
                  disabled={saving}
                  onClick={() => toggle(key)}
                  className={`relative shrink-0 mt-1 h-7 w-12 rounded-full transition-colors disabled:opacity-60 ${
                    on ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      on ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
