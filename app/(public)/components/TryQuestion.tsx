"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

export interface DemoQuestion {
  slug: string;
  subjectName: string;
  year: number;
  text: string;
  options: { label: string; text: string }[];
  answer: string;
}

// A once-a-second clock shared by the timer. Null on the server, so the first
// render shows 00:00 on both sides and hydration matches.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const getNow = () => Math.floor(Date.now() / 1000);
const getServerNow = () => null;

const clock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * The landing page's hero: a few real past questions on a screen laid out like
 * the JAMB CBT (title bar, clock, question palette), with the same keyboard
 * keys: A–D to answer, N and P for next and previous. Answers are marked the
 * moment they're picked.
 */
export function TryQuestion({ questions }: { questions: DemoQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [start] = useState(getNow);
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);

  const q = questions[index];
  const picked = picks[index];
  const answered = Object.keys(picks).length;
  const score = questions.filter((qq, i) => picks[i] === qq.answer).length;
  const done = answered === questions.length;

  const go = (i: number) => setIndex(Math.min(questions.length - 1, Math.max(0, i)));
  const pick = (label: string) => {
    if (picked) return;
    setPicks((p) => ({ ...p, [index]: label }));
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toUpperCase();
    if (q.options.some((o) => o.label === key)) {
      e.preventDefault();
      pick(key);
    } else if (key === "N") {
      go(index + 1);
    } else if (key === "P") {
      go(index - 1);
    }
  }

  return (
    <section
      aria-label="Try a past question"
      onKeyDown={onKeyDown}
      className="overflow-hidden rounded-xl bg-[#f4f8fc] text-slate-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
    >
      {/* Title bar, like the CBT window's */}
      <div className="flex items-center justify-between gap-3 bg-[#0b3a63] px-4 py-2.5 text-sm text-white">
        <span className="font-semibold">
          {q.subjectName}, JAMB {q.year}
        </span>
        <span className="tabular-nums" aria-label="Time on this screen">
          {clock(now === null ? 0 : Math.max(0, now - start))}
        </span>
      </div>

      <div className="grid md:grid-cols-[1fr_13rem]">
        <div className="p-5 sm:p-7">
          <p className="text-sm font-semibold text-slate-500">
            Question {index + 1} of {questions.length}
          </p>
          <p className="mt-2 text-lg sm:text-xl leading-relaxed font-medium">{q.text}</p>

          <ul className="mt-5 space-y-2">
            {q.options.map((o) => {
              const isPick = picked === o.label;
              const isAnswer = q.answer === o.label;
              const state = !picked
                ? "border-slate-300 bg-white hover:border-brand-600 hover:bg-brand-50"
                : isAnswer
                  ? "border-mint-600 bg-mint-50 text-mint-900"
                  : isPick
                    ? "border-rose-400 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-white text-slate-400";
              return (
                <li key={o.label}>
                  <button
                    type="button"
                    onClick={() => pick(o.label)}
                    // aria-disabled, not disabled: a disabled button drops keyboard
                    // focus to <body>, and then N and P stop reaching onKeyDown.
                    aria-disabled={!!picked}
                    aria-pressed={isPick}
                    className={`flex w-full items-start gap-3 rounded-lg border-2 px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 aria-disabled:cursor-default ${state}`}
                  >
                    <kbd className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded border border-current/30 font-sans text-xs font-bold">
                      {o.label}
                    </kbd>
                    <span>{o.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div aria-live="polite" className="mt-3 min-h-7">
            {picked && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {picked === q.answer ? (
                  <span className="inline-flex items-center gap-2 font-bold text-mint-700">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden className="text-[#feb12c] motion-safe:animate-[star-pop_500ms_ease-out]">
                      <path fill="currentColor" d="M12 1.5 14.3 9.7 22.5 12 14.3 14.3 12 22.5 9.7 14.3 1.5 12 9.7 9.7Z" />
                    </svg>
                    Correct.
                  </span>
                ) : (
                  <span className="font-bold text-rose-700">Not this time. The answer is {q.answer}.</span>
                )}
                <Link href={`/question/${q.slug}`} className="text-sm font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800">
                  See why
                </Link>
              </p>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:border-slate-400 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === questions.length - 1}
              className="rounded-md bg-[#0b3a63] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d4a7e] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        {/* Question palette */}
        <aside className="border-t border-slate-200 bg-white/60 p-5 md:border-l md:border-t-0">
          <p className="text-sm font-semibold text-slate-500">Questions</p>
          <ol className="mt-3 flex flex-wrap gap-2">
            {questions.map((qq, i) => {
              const p = picks[i];
              const tone = !p
                ? "border-slate-300 bg-white text-slate-700"
                : p === qq.answer
                  ? "border-mint-600 bg-mint-600 text-white"
                  : "border-rose-400 bg-rose-400 text-white";
              return (
                <li key={qq.slug}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Question ${i + 1}${p ? (p === qq.answer ? ", correct" : ", wrong") : ""}`}
                    aria-current={i === index ? "step" : undefined}
                    className={`h-9 w-9 rounded-md border-2 text-sm font-bold tabular-nums ${tone} ${i === index ? "ring-2 ring-brand-600 ring-offset-2" : ""}`}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 hidden text-xs leading-relaxed text-slate-500 md:block">
            Keys work here like in the real CBT: A to D to answer, N for next, P for previous.
          </p>
          {done && (
            <div className="mt-5 rounded-lg bg-[#0b3a63] p-3 text-sm text-white">
              <p className="font-bold">
                {score} of {questions.length}
              </p>
              <Link href="/register" className="mt-1 inline-block font-semibold text-mint-300 underline underline-offset-4">
                Keep going, free
              </Link>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
