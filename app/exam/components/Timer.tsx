"use client";

import { useState, useEffect } from "react";

interface TimerProps {
  initialMinutes?: number;
  /** Full length of the exam; the ring shows time left as a share of this. */
  totalMinutes?: number;
  onExpire?: () => void;
}

const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const pad = (n: number) => n.toString().padStart(2, "0");

export default function Timer({ initialMinutes = 120, totalMinutes, onExpire }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60);

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.();
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalId);
          onExpire?.();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const isWarning = timeLeft < 300; // < 5 minutes
  const totalSeconds = Math.max((totalMinutes ?? initialMinutes) * 60, 1);
  const fraction = Math.min(timeLeft / totalSeconds, 1);

  return (
    <div
      role="timer"
      aria-label={`Time left: ${hours > 0 ? `${hours} hours ` : ""}${minutes} minutes ${seconds} seconds`}
      className={`relative flex-shrink-0 flex items-center justify-center font-bold tabular-nums ${
        isWarning ? "text-red-600 dark:text-red-400 animate-pulse" : "text-slate-900 dark:text-slate-100"
      }`}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
            isWarning ? "stroke-red-500" : "stroke-indigo-600 dark:stroke-indigo-400"
          }`}
        />
      </svg>
      {/* Over an hour there is no room for H:MM:SS inside the ring, so seconds drop to a second line. */}
      {hours > 0 ? (
        <span className="relative flex flex-col items-center leading-none">
          <span className="text-[13px]">{hours}:{pad(minutes)}</span>
          <span className="text-[9px] font-semibold opacity-60 mt-0.5">{pad(seconds)}s</span>
        </span>
      ) : (
        <span className="relative text-[13px]">{pad(minutes)}:{pad(seconds)}</span>
      )}
    </div>
  );
}
