"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { apiClient, ApiError } from "@/lib/api/client";
import CloudinaryUploader from "@/app/components/CloudinaryUploader";
import { BLOG_CATEGORIES, categoryLabel, type BlogCategory } from "@/app/blog/categories";

export interface BlogPostFormData {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  category: BlogCategory;
}

export interface BlogEditorProps {
  mode: "create" | "edit";
  initial?: Partial<BlogPostFormData> & { id?: string; publishedAt?: string | null; notifiedAt?: string | null };
}

const EMPTY: BlogPostFormData = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverImageUrl: null,
  category: "GENERAL",
};

export default function BlogEditor({ mode, initial }: BlogEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<BlogPostFormData>({ ...EMPTY, ...initial } as BlogPostFormData);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isPublished = !!initial?.publishedAt;
  const wasNotified = !!initial?.notifiedAt;

  function update<K extends keyof BlogPostFormData>(key: K, value: BlogPostFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return "Title is required.";
    if (!form.excerpt.trim()) return "Excerpt is required — it's used in emails and previews.";
    if (!form.body.trim()) return "Body cannot be empty.";
    return null;
  }

  async function handleSave(): Promise<string | null> {
    const issue = validate();
    if (issue) {
      setError(issue);
      return null;
    }
    setError("");
    setSuccess("");
    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      excerpt: form.excerpt.trim(),
      body: form.body,
      coverImageUrl: form.coverImageUrl,
      category: form.category,
    };

    try {
      if (mode === "create") {
        const created = await apiClient<{ id: string; slug: string }>("/api/admin/blog", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Draft saved.");
        // Switch the URL to the edit route so further saves PATCH.
        router.replace(`/admin/blog/${created.id}`);
        return created.id;
      } else {
        const updated = await apiClient<{ id: string }>(`/api/admin/blog/${initial?.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess("Saved.");
        return updated.id;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save post.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }

    // Save first so the published version reflects current edits.
    const id = await handleSave();
    if (!id) return;

    setError("");
    setPublishing(true);
    try {
      await apiClient(`/api/admin/blog/${id}/publish`, { method: "POST" });
      setSuccess(
        wasNotified
          ? "Published. (Email blast already sent earlier — Premium users won't get a duplicate.)"
          : "Published! Premium users will receive the email shortly.",
      );
      // Refresh to pick up new publishedAt / notifiedAt state.
      setTimeout(() => router.refresh(), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!initial?.id) return;
    setError("");
    try {
      await apiClient(`/api/admin/blog/${initial.id}/unpublish`, { method: "POST" });
      setSuccess("Unpublished. The post is hidden from the public blog.");
      setTimeout(() => router.refresh(), 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unpublish.");
    }
  }

  // Clear transient success messages after a few seconds
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(t);
  }, [success]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog" className="text-sm text-slate-500 hover:text-slate-300">← All posts</Link>
          {mode === "edit" && (
            <span
              className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isPublished
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/30"
              }`}
            >
              {isPublished ? "Published" : "Draft"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={submitting || publishing}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Save draft"}
          </button>
          {mode === "edit" && isPublished ? (
            <button
              onClick={handleUnpublish}
              disabled={submitting || publishing}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={submitting || publishing}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div>
            <label className="text-sm font-medium block mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="A clear, scroll-stopping headline"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-lg"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Excerpt</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => update("excerpt", e.target.value)}
              placeholder="1–2 sentence summary — shown in lists and emails."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Body (Markdown)</label>
              <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setTab("write")}
                  className={`px-3 py-1.5 font-medium transition-colors ${tab === "write" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setTab("preview")}
                  className={`px-3 py-1.5 font-medium transition-colors ${tab === "preview" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Preview
                </button>
              </div>
            </div>

            {tab === "write" ? (
              <textarea
                value={form.body}
                onChange={(e) => update("body", e.target.value)}
                placeholder={"# Heading\n\nWrite your post in **Markdown**. Use - for lists, [text](url) for links."}
                rows={20}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm leading-relaxed resize-y"
              />
            ) : (
              <div className="prose prose-invert prose-sm max-w-none p-5 rounded-xl bg-slate-900/40 border border-slate-700 min-h-[400px]">
                {form.body.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{form.body}</ReactMarkdown>
                ) : (
                  <p className="text-slate-500 italic">Nothing to preview yet — start writing.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <CloudinaryUploader
            folder="blog"
            value={form.coverImageUrl}
            onChange={(url) => update("coverImageUrl", url)}
          />

          <div>
            <label className="text-sm font-medium block mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value as BlogCategory)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {BLOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">URL slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="auto-generated from title"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Leave blank to derive from title.</p>
          </div>

          {mode === "edit" && wasNotified && (
            <div className="rounded-xl bg-slate-900/40 border border-slate-700 p-4 text-xs text-slate-400">
              Email blast already sent. Re-publishing won&apos;t resend.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
