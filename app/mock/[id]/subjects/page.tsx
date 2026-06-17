"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { mockFetch } from "@/lib/api/mockClient";

interface SubjectOptions {
  compulsory: string[];
  electives: string[];
  minElectives: number;
  maxElectives: number;
}

const RULES = [
  { icon: "🖥️", text: "This exam runs in fullscreen. Exiting fullscreen counts as a violation." },
  { icon: "🔄", text: "Switching tabs or apps is detected. Stay on this page for the entire session." },
  { icon: "⚠️", text: "You have 2 strikes. Exhausting them auto-submits your exam immediately." },
  { icon: "🚫", text: "Copying, cutting, and right-clicking are disabled during the exam." },
  { icon: "⏱️", text: "The timer starts the moment you click Begin. It does not pause." },
];

export default function MockSubjectsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [options, setOptions] = useState<SubjectOptions | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(`mock_token_${id}`);
    if (!token) { router.replace(`/mock/${id}/login`); return; }

    // Resume straight to the exam if a session is already in progress.
    mockFetch<unknown | null>("/api/mock/sessions/current", id)
      .then((current) => {
        if (current) { router.replace(`/mock/${id}/exam`); return null; }
        return mockFetch<SubjectOptions>("/api/mock/subject-options", id);
      })
      .then((opts) => {
        if (!opts) return;
        setOptions(opts);
        // Nothing to choose when ≤2 electives exist — they're auto-included.
        if (opts.electives.length <= 2) setSelected(opts.electives);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(`mock_token_${id}`);
          router.replace(`/mock/${id}/login`);
        } else {
          setError("Could not load the exam. Please try again.");
          setLoading(false);
        }
      });
  }, [id, router]);

  const fixedElectives = (options?.electives.length ?? 0) <= 2;

  function toggle(subject: string) {
    if (!options || fixedElectives) return;
    setSelected((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : prev.length < options.maxElectives
        ? [...prev, subject]
        : prev,
    );
  }

  const canBegin =
    !!options &&
    selected.length >= options.minElectives &&
    selected.length <= options.maxElectives;

  async function handleBegin() {
    if (!canBegin || starting) return;
    setStarting(true);
    setError("");
    try {
      await document.documentElement.requestFullscreen().catch(() => {});
      await mockFetch("/api/mock/sessions", id, {
        method: "POST",
        body: JSON.stringify({ subjects: selected }),
      });
      router.push(`/mock/${id}/exam`);
    } catch (err) {
      setStarting(false);
      setError(err instanceof ApiError ? err.message : "Failed to start exam. Please try again.");
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">📝</div>
          <h1 className="text-2xl font-bold">Choose your subjects</h1>
          <p className="text-sm text-slate-400">
            English, Mathematics and General Knowledge are compulsory.{" "}
            {options && options.electives.length > 2
              ? `Pick ${options.minElectives === options.maxElectives ? options.minElectives : `${options.minElectives}–${options.maxElectives}`} electives.`
              : "Your electives are included automatically."}
          </p>
        </div>

        {/* Compulsory subjects */}
        {options && options.compulsory.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-500">Compulsory</p>
            <div className="flex flex-wrap gap-2">
              {options.compulsory.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-indigo-600/20 border border-indigo-500/40 text-indigo-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Elective picker */}
        {options && options.electives.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {fixedElectives ? "Electives (included)" : "Electives"}
              </p>
              {!fixedElectives && (
                <span className="text-xs text-slate-400">{selected.length}/{options.maxElectives} picked</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {options.electives.map((s) => {
                const isSelected = selected.includes(s);
                const isDisabled = fixedElectives || (!isSelected && selected.length >= options.maxElectives);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    disabled={isDisabled && !isSelected}
                    className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all disabled:opacity-40 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                        : "border-white/10 hover:border-white/25 text-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Rules */}
        <div className="rounded-2xl bg-white/5 p-5 space-y-3">
          <h2 className="font-semibold text-sm">Before you begin</h2>
          <ul className="space-y-2.5">
            {RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="text-base leading-5 shrink-0">{rule.icon}</span>
                <span>{rule.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <button
          onClick={handleBegin}
          disabled={!canBegin || starting}
          className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? "Starting…" : "I understand — Begin Exam"}
        </button>

        <p className="text-center text-xs text-slate-500">
          By starting, you agree to complete this exam honestly without assistance.
        </p>
      </div>
    </div>
  );
}
