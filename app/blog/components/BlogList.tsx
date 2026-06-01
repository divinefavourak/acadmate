"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { BLOG_CATEGORIES, categoryLabel, type BlogCategory } from "../categories";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BlogListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: BlogCategory;
  publishedAt: string;
  author: { name: string | null } | null;
}

interface BlogListResponse {
  posts: BlogListItem[];
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

export function FeaturedCard({ post }: { post: BlogListItem }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:border-indigo-500/40 transition-all"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <div className="aspect-video md:aspect-auto bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
          {post.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600/30 to-purple-600/20" />
          )}
        </div>
        <div className="p-6 md:p-10 flex flex-col justify-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
            {categoryLabel(post.category)}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors">
            {post.title}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 line-clamp-3">{post.excerpt}</p>
          <div className="text-xs text-slate-500 pt-2">
            {post.author?.name ?? "Acadmate"} · {formatDate(post.publishedAt)}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PostCard({ post }: { post: BlogListItem }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all flex flex-col"
    >
      <div className="aspect-video bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-300/40 to-slate-400/30 dark:from-slate-700/30 dark:to-slate-900/50" />
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
          {categoryLabel(post.category)}
        </span>
        <h3 className="font-bold leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors">
          {post.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 flex-1">{post.excerpt}</p>
        <div className="text-xs text-slate-500 pt-2">
          {post.author?.name ?? "Acadmate"} · {formatDate(post.publishedAt)}
        </div>
      </div>
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LIMIT = 12;

export default function BlogList({
  initialPosts,
  initialTotal,
}: {
  initialPosts: BlogListItem[];
  initialTotal: number;
}) {
  const [posts, setPosts] = useState<BlogListItem[]>(initialPosts);
  const [total, setTotal] = useState(initialTotal);
  const [activeCategory, setActiveCategory] = useState<BlogCategory | "">("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (page === 0 && activeCategory === "") {
      setPosts(initialPosts);
      setTotal(initialTotal);
      return;
    }
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(page * LIMIT),
    });
    if (activeCategory) qs.set("category", activeCategory);
    apiClient<BlogListResponse>(`/api/blog?${qs.toString()}`, { skipAuth: true })
      .then((data) => {
        setPosts(data.posts);
        setTotal(data.total);
      })
      .catch(() => setError("Could not load posts. Please refresh."))
      .finally(() => setLoading(false));
  }, [activeCategory, page, initialPosts, initialTotal]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const featured = useMemo(
    () => (page === 0 && !activeCategory ? posts[0] : undefined),
    [posts, page, activeCategory],
  );
  const rest = useMemo(
    () => (featured ? posts.slice(1) : posts),
    [posts, featured],
  );

  return (
    <div className="space-y-10">
      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          active={activeCategory === ""}
          onClick={() => { setActiveCategory(""); setPage(0); }}
        />
        {BLOG_CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat}
            label={categoryLabel(cat)}
            active={activeCategory === cat}
            onClick={() => { setActiveCategory(cat); setPage(0); }}
          />
        ))}
      </div>

      {error ? (
        <p className="text-red-600 dark:text-red-400 text-sm py-12 text-center">{error}</p>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-12 text-center space-y-2">
          <p className="text-slate-700 dark:text-slate-300 font-medium">Nothing here yet.</p>
          <p className="text-slate-500 text-sm">
            {activeCategory
              ? "No posts in this category yet — check back soon."
              : "We’re still writing. Come back in a bit."}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {featured && <FeaturedCard post={featured} />}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((p) => <PostCard key={p.id} post={p} />)}
          </div>

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
        </div>
      )}
    </div>
  );
}
