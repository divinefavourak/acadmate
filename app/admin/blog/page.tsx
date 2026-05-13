"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";
import { categoryLabel, type BlogCategory } from "@/app/blog/categories";

// Shared button styles for action rows. Keep these consistent across actions
// so the row reads as one toolbar rather than a pile of misc links.
const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN_BASE} bg-indigo-600 hover:bg-indigo-500 text-white`;
const BTN_SECONDARY = `${BTN_BASE} border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`;
const BTN_WARNING = `${BTN_BASE} border border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10`;
const BTN_DANGER = `${BTN_BASE} text-slate-500 hover:text-red-500 hover:bg-red-500/10`;

function SharePostButton({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/blog/${slug}`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={handleShare} className={BTN_SECONDARY}>
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

interface AdminBlogListItem {
  id: string;
  slug: string;
  title: string;
  category: BlogCategory;
  publishedAt: string | null;
  notifiedAt: string | null;
  updatedAt: string;
  author: { name: string | null } | null;
}

interface AdminBlogListResponse {
  posts: AdminBlogListItem[];
  total: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminBlogListPage() {
  const [posts, setPosts] = useState<AdminBlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError("");
    apiClient<AdminBlogListResponse>("/api/admin/blog?limit=50")
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load posts."))
      .finally(() => setLoading(false));
  }

  async function handleNotify(p: AdminBlogListItem) {
    const isResend = !!p.notifiedAt;
    const verb = isResend ? "Re-send" : "Send";
    const prompt = isResend
      ? `This post was already emailed on ${formatDate(p.notifiedAt!)}. Send again to all Premium users?`
      : `Send "${p.title}" to all Premium users now?`;
    if (!confirm(prompt)) return;

    setError("");
    setInfo("");
    setBusyId(p.id);
    try {
      const res = await apiClient<{ recipients: number; successes: number; failures: number }>(
        `/api/admin/blog/${p.id}/notify`,
        { method: "POST" },
      );
      if (res.recipients === 0) {
        setInfo("No Premium users to email yet.");
      } else if (res.failures === 0) {
        setInfo(`${verb} complete — emailed ${res.successes} Premium user(s).`);
      } else {
        setInfo(
          `${verb} partial — ${res.successes}/${res.recipients} sent, ${res.failures} failed. Check server logs.`,
        );
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send email.");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePublish(id: string) {
    setBusyId(id);
    try {
      await apiClient(`/api/admin/blog/${id}/publish`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnpublish(id: string) {
    setBusyId(id);
    try {
      await apiClient(`/api/admin/blog/${id}/unpublish`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unpublish.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await apiClient(`/api/admin/blog/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Blog</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
            News, study tips, scholarships, school updates — published to the public blog.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          New post
        </Link>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {info && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-sm">
          {info}
        </div>
      )}

      {loading ? (
        <div className="glass-panel rounded-2xl">
          <Loader className="py-16" />
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-panel rounded-2xl py-16 text-center space-y-2">
          <p className="text-slate-500">No posts yet.</p>
          <Link href="/admin/blog/new" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 font-medium text-sm">
            Write your first post →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:gap-4">
          {posts.map((p) => (
            <li
              key={p.id}
              className="glass-panel rounded-2xl p-4 sm:p-5 hover:border-indigo-500/30 transition-colors"
            >
              <div className="flex flex-col gap-4">
                {/* Title + status badges */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/blog/${p.id}`}
                      className="block font-semibold text-base sm:text-lg leading-snug hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors break-words"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-slate-500 font-mono mt-1 truncate">/{p.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {p.publishedAt ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                        Draft
                      </span>
                    )}
                    {p.notifiedAt && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                        Emailed
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span><span className="text-slate-400 dark:text-slate-600">Category · </span>{categoryLabel(p.category)}</span>
                  <span><span className="text-slate-400 dark:text-slate-600">Updated · </span>{formatDate(p.updatedAt)}</span>
                  {p.notifiedAt && (
                    <span><span className="text-slate-400 dark:text-slate-600">Last emailed · </span>{formatDate(p.notifiedAt)}</span>
                  )}
                </div>

                {/* Action toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                  {p.publishedAt ? (
                    <button
                      onClick={() => handleUnpublish(p.id)}
                      disabled={busyId === p.id}
                      className={BTN_WARNING}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                      Unpublish
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePublish(p.id)}
                      disabled={busyId === p.id}
                      className={BTN_PRIMARY}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      Publish
                    </button>
                  )}

                  <Link href={`/admin/blog/${p.id}`} className={BTN_SECONDARY}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    Edit
                  </Link>

                  {p.publishedAt && (
                    <>
                      <button
                        onClick={() => handleNotify(p)}
                        disabled={busyId === p.id}
                        title={p.notifiedAt ? `Already emailed ${formatDate(p.notifiedAt)} — click to resend` : "Email this post to all Premium users"}
                        className={p.notifiedAt ? BTN_SECONDARY : BTN_PRIMARY}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        {p.notifiedAt ? "Re-send email" : "Send email"}
                      </button>
                      <SharePostButton slug={p.slug} title={p.title} />
                    </>
                  )}

                  <button
                    onClick={() => handleDelete(p.id, p.title)}
                    disabled={busyId === p.id}
                    className={`${BTN_DANGER} ml-auto`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
