"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";
import { categoryLabel, type BlogCategory } from "@/app/blog/categories";

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
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError("");
    apiClient<AdminBlogListResponse>("/api/admin/blog?limit=50")
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load posts."))
      .finally(() => setLoading(false));
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            News, study tips, scholarships, school updates — published to the public blog.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          New post
        </Link>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <Loader className="py-16" />
        ) : posts.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-slate-500">No posts yet.</p>
            <Link href="/admin/blog/new" className="text-indigo-400 hover:text-indigo-300 font-medium text-sm">
              Write your first post →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`${i < posts.length - 1 ? "border-b border-slate-200 dark:border-slate-800/50" : ""} hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors`}
                  >
                    <td className="px-5 py-4 font-medium">
                      <Link href={`/admin/blog/${p.id}`} className="hover:text-indigo-400 transition-colors">
                        {p.title}
                      </Link>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">/{p.slug}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{categoryLabel(p.category)}</td>
                    <td className="px-5 py-4">
                      {p.publishedAt ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {p.notifiedAt ? `Sent ${formatDate(p.notifiedAt)}` : "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{formatDate(p.updatedAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {p.publishedAt ? (
                          <button
                            onClick={() => handleUnpublish(p.id)}
                            disabled={busyId === p.id}
                            className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50"
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePublish(p.id)}
                            disabled={busyId === p.id}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                          >
                            Publish
                          </button>
                        )}
                        <Link href={`/admin/blog/${p.id}`} className="text-xs font-medium text-slate-400 hover:text-white">
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.title)}
                          disabled={busyId === p.id}
                          className="text-xs font-medium text-slate-400 hover:text-red-400 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
