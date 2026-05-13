"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { apiClient, ApiError } from "@/lib/api/client";
import { categoryLabel, type BlogCategory } from "../categories";

interface BlogPostDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  category: BlogCategory;
  publishedAt: string;
  author: { name: string | null } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BlogDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    apiClient<BlogPostDetail>(`/api/blog/${encodeURIComponent(slug)}`, { skipAuth: true })
      .then((data) => setPost(data))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else console.error("Failed to load post", err);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <article className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-10 w-3/4 bg-white/10 rounded" />
        <div className="h-72 bg-white/5 rounded-2xl" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-white/5 rounded" />
          <div className="h-4 w-11/12 bg-white/5 rounded" />
          <div className="h-4 w-10/12 bg-white/5 rounded" />
        </div>
      </article>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-4 py-16">
        <h1 className="text-3xl font-bold">Post not found</h1>
        <p className="text-slate-400">It may have been unpublished or moved.</p>
        <button
          onClick={() => router.push("/blog")}
          className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium"
        >
          ← Back to blog
        </button>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to blog
      </Link>

      <header className="space-y-5 mb-8">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.14em] bg-indigo-600/15 text-indigo-300 border border-indigo-500/20">
          {categoryLabel(post.category)}
        </span>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">{post.title}</h1>
        <p className="text-lg text-slate-400 leading-relaxed">{post.excerpt}</p>
        <div className="flex items-center gap-3 text-sm text-slate-500 pt-2 border-t border-white/5">
          <span className="font-medium text-slate-300">{post.author?.name ?? "Acadmate"}</span>
          <span>·</span>
          <span>{formatDate(post.publishedAt)}</span>
        </div>
      </header>

      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt=""
          className="w-full rounded-2xl border border-white/10 mb-10"
        />
      )}

      <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {post.body}
        </ReactMarkdown>
      </div>

      <footer className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          Want this delivered to your inbox?{" "}
          <Link href="/dashboard/upgrade" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Go Premium
          </Link>{" "}
          for free email updates.
        </p>
        <Link href="/blog" className="text-sm text-slate-400 hover:text-white transition-colors">
          More posts →
        </Link>
      </footer>
    </article>
  );
}
