"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { listThreads, createThread } from "@/features/forum/api";
import type { ForumThread, ForumCategory } from "@/features/forum/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: ForumCategory | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "GENERAL", label: "General" },
  { value: "UTME", label: "UTME" },
  { value: "POST_UTME", label: "Post-UTME" },
  { value: "JAMB", label: "JAMB" },
  { value: "SCHOLARSHIPS", label: "Scholarships" },
  { value: "STUDY_TIPS", label: "Study Tips" },
  { value: "SCHOOL_NEWS", label: "School News" },
];

function categoryLabel(cat: ForumCategory): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Thread list item ────────────────────────────────────────────────────────

function ThreadItem({ thread }: { thread: ForumThread }) {
  return (
    <Link
      href={`/forum/${thread.id}`}
      className="group flex items-start gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
        {(thread.author.name?.trim() || "?")[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors line-clamp-1">
            {thread.title}
          </h3>
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
            {categoryLabel(thread.category)}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
          {thread.body}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-slate-500">
          <span>{thread.author.name ?? "Anonymous"}</span>
          <span>·</span>
          <span>{timeAgo(thread.createdAt)}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {thread.replyCount}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Create thread modal ──────────────────────────────────────────────────────

function CreateThreadModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (t: ForumThread) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ForumCategory>("GENERAL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.getElementById("thread-title")?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const { thread } = await createThread({ title: title.trim(), body: body.trim(), category });
      onCreate(thread);
    } catch {
      setError("Failed to post. Are you signed in?");
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="thread-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="thread-dialog-title" className="font-bold text-lg">New thread</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="thread-category" className="block text-sm font-medium mb-1.5">Category</label>
            <select
              id="thread-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ForumCategory)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.filter((c) => c.value !== "").map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="thread-title" className="block text-sm font-medium mb-1.5">Title</label>
            <input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your question or topic?"
              maxLength={200}
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="thread-body" className="block text-sm font-medium mb-1.5">Body</label>
            <textarea
              id="thread-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Give more details…"
              rows={5}
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Posting…" : "Post thread"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LIMIT = 20;

export default function ForumListContent({
  initialThreads,
  initialTotal,
}: {
  initialThreads: ForumThread[];
  initialTotal: number;
}) {
  const [threads, setThreads] = useState<ForumThread[]>(initialThreads);
  const [total, setTotal] = useState(initialTotal);
  const [category, setCategory] = useState<ForumCategory | "">("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (page === 0 && category === "") {
      setThreads(initialThreads);
      setTotal(initialTotal);
      return;
    }
    setLoading(true);
    setError("");
    listThreads({ category: category || undefined, limit: LIMIT, offset: page * LIMIT })
      .then((data) => {
        setThreads(data.threads);
        setTotal(data.total);
      })
      .catch(() => setError("Could not load threads. Please refresh."))
      .finally(() => setLoading(false));
  }, [category, page, initialThreads, initialTotal]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value as ForumCategory | ""); setPage(0); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                category === cat.value
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          New thread
        </button>
      </div>

      {/* Thread list */}
      {error ? (
        <p className="text-red-500 text-sm py-10 text-center">{error}</p>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center space-y-2">
          <p className="font-medium text-slate-700 dark:text-slate-300">No threads yet.</p>
          <p className="text-sm text-slate-500">Be the first to start a discussion!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => <ThreadItem key={t.id} thread={t} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/5">
          <p className="text-sm text-slate-500">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateThreadModal
          onClose={() => setShowCreate(false)}
          onCreate={(t) => {
            setThreads((prev) => [t, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
