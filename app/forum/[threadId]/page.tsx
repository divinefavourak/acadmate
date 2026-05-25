"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getThread, createReply } from "@/features/forum/api";
import type { ForumThread, ForumReply } from "@/features/forum/types";

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ name }: { name: string | null }) {
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
      {(name ?? "?")[0].toUpperCase()}
    </div>
  );
}

export default function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [replyBody, setReplyBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  useEffect(() => {
    getThread(threadId)
      .then(({ thread: t, replies: r }) => {
        setThread(t);
        setReplies(r);
      })
      .catch(() => setError("Could not load thread. Please refresh."))
      .finally(() => setLoading(false));
  }, [threadId]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setPosting(true);
    setPostError("");
    try {
      const { reply } = await createReply(threadId, replyBody.trim());
      setReplies((prev) => [...prev, reply]);
      setReplyBody("");
      if (thread) setThread({ ...thread, replyCount: thread.replyCount + 1 });
    } catch {
      setPostError("Failed to post reply. Are you signed in?");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-slate-100 dark:bg-white/5 animate-pulse" />
        <div className="h-40 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-red-500">{error || "Thread not found."}</p>
        <Link href="/forum" className="text-sm text-indigo-500 hover:underline">← Back to forum</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/forum" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Forum</Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1">{thread.title}</span>
      </nav>

      {/* Original thread */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Avatar name={thread.author.name} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">{thread.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {thread.author.name ?? "Anonymous"} · {timeAgo(thread.createdAt)}
            </p>
          </div>
        </div>
        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">{thread.body}</p>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">
          {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
        </h2>

        {replies.length === 0 && (
          <p className="text-sm text-slate-400 py-4">No replies yet. Be the first!</p>
        )}

        {replies.map((r) => (
          <div key={r.id} className="flex items-start gap-3 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02]">
            <Avatar name={r.author.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{r.author.name ?? "Anonymous"}</span>
                <span className="text-xs text-slate-400">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{r.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply form */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Leave a reply</h3>
        <form onSubmit={handleReply} className="space-y-3">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write your reply… (sign in required)"
            rows={4}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          {postError && <p className="text-sm text-red-500">{postError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !replyBody.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {posting ? "Posting…" : "Post reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
