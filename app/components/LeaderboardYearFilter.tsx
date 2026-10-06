"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

type LeaderboardType = "UTME" | "POST_UTME";

/** "earned" ranks by the calendar year points were earned; "paper" by past-paper year. */
type Basis = "earned" | "paper";

interface Years {
  periods: number[];
  paperYears: number[];
}

interface Selection {
  basis: Basis;
  /** null = all-time (only valid for "earned"). */
  year: number | null;
}

/**
 * Year picker state for a leaderboard. `query` is the string to append to the
 * leaderboard request ("" for all-time).
 */
export function useLeaderboardYears(type: LeaderboardType, basePath = "/api/leaderboard") {
  const [years, setYears] = useState<Years>({ periods: [], paperYears: [] });
  const [selection, setSelection] = useState<Selection>({ basis: "earned", year: null });

  useEffect(() => {
    let cancelled = false;
    apiClient<Years>(`${basePath}/years?type=${type}`)
      .then((data) => { if (!cancelled) setYears(data); })
      .catch(() => { /* the picker just stays on all-time */ });
    return () => { cancelled = true; };
  }, [type, basePath]);

  const query =
    selection.year === null
      ? ""
      : selection.basis === "earned"
      ? `&period=${selection.year}`
      : `&paperYear=${selection.year}`;

  const label =
    selection.year === null
      ? "all time"
      : selection.basis === "earned"
      ? `in ${selection.year}`
      : `on ${selection.year} past questions`;

  return { years, selection, setSelection, query, label };
}

const chip = "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors";
const chipOn = "bg-indigo-600 border-indigo-600 text-white";
const chipOff = "border-slate-500/40 text-slate-400 hover:text-indigo-400 hover:border-indigo-400/60";

export default function LeaderboardYearFilter({
  years,
  selection,
  onChange,
}: {
  years: Years;
  selection: Selection;
  onChange: (next: Selection) => void;
}) {
  const hasPaperYears = years.paperYears.length > 0;
  const options = selection.basis === "earned" ? years.periods : years.paperYears;

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-slate-500/40 overflow-hidden text-xs">
        <button
          type="button"
          aria-pressed={selection.basis === "earned"}
          onClick={() => onChange({ basis: "earned", year: null })}
          className={`px-3 py-1.5 font-medium transition-colors ${selection.basis === "earned" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-indigo-400"}`}
        >
          By year earned
        </button>
        <button
          type="button"
          aria-pressed={selection.basis === "paper"}
          disabled={!hasPaperYears}
          title={hasPaperYears ? undefined : "No past-paper results yet"}
          onClick={() => onChange({ basis: "paper", year: years.paperYears[0] })}
          className={`px-3 py-1.5 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${selection.basis === "paper" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-indigo-400"}`}
        >
          By past-paper year
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {selection.basis === "earned" && (
          <button
            type="button"
            aria-pressed={selection.year === null}
            onClick={() => onChange({ basis: "earned", year: null })}
            className={`${chip} ${selection.year === null ? chipOn : chipOff}`}
          >
            All-time
          </button>
        )}
        {options.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={selection.year === y}
            onClick={() => onChange({ basis: selection.basis, year: y })}
            className={`${chip} tabular-nums ${selection.year === y ? chipOn : chipOff}`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}
