"use client";

import { useState } from "react";
import type { School } from "./types";

interface Props {
  school: School;
  /** Rendered size in px (square). Default: 56 (w-14 h-14). */
  size?: number;
  className?: string;
}

export function SchoolLogo({ school, size = 56, className = "" }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const showLogo = !!school.logoUrl && !imgFailed;

  return (
    <div
      style={{ width: size, height: size }}
      className={`flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center ${
        showLogo
          ? "bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10"
          : "bg-indigo-100 dark:bg-indigo-900/40"
      } ${className}`}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={school.logoUrl}
          alt={`${school.abbr} logo`}
          width={size}
          height={size}
          className="object-contain p-1.5"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
          {school.abbr.slice(0, 3)}
        </span>
      )}
    </div>
  );
}
