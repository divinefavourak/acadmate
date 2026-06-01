"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { categoryLabel, type BlogCategory } from "../categories";

export interface BlogPostDetail {
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

function ShareButton({ title, excerpt }: { title: string; excerpt: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: excerpt, url });
      } catch {
        // user cancelled — no-op
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
    >
      {copied ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          Copied!
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
          Share
        </>
      )}
    </button>
  );
}

export function BlogPostContent({ post }: { post: BlogPostDetail }) {
  return (
    <article className="max-w-3xl mx-auto">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to blog
      </Link>

      <header className="space-y-5 mb-8">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.14em] bg-indigo-600/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
          {categoryLabel(post.category)}
        </span>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">{post.title}</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">{post.excerpt}</p>
        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">{post.author?.name ?? "Acadmate"}</span>
            <span>·</span>
            <span>{formatDate(post.publishedAt)}</span>
          </div>
          <ShareButton title={post.title} excerpt={post.excerpt} />
        </div>
      </header>

      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt={`Cover image for: ${post.title}`}
          className="w-full rounded-2xl border border-black/5 dark:border-white/10 mb-10"
        />
      )}

      <div className="prose dark:prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {post.body}
        </ReactMarkdown>
      </div>

      <footer className="mt-16 pt-8 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Want this delivered to your inbox?{" "}
          <Link href="/dashboard/upgrade" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium">
            Go Premium
          </Link>{" "}
          for free email updates.
        </p>
        <div className="flex items-center gap-4">
          <ShareButton title={post.title} excerpt={post.excerpt} />
          <Link href="/blog" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            More posts →
          </Link>
        </div>
      </footer>
    </article>
  );
}
