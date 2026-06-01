import type { Metadata } from "next";
import BlogList, { type BlogListItem } from "./components/BlogList";
import { buildMetadata } from "@/lib/seo";

// ─── ISR ─────────────────────────────────────────────────────────────────────

export const revalidate = 300; // 5 minutes

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = buildMetadata({
  title: "Blog – JAMB News, Study Tips & Nigerian Student Opportunities",
  description:
    "UTME and Post-UTME updates, JAMB announcements, scholarship calls, university news and career guides for Nigerian students. Updated regularly by the Acadmate team.",
  path: "/blog",
});

// ─── Data fetching ────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getInitialPosts(): Promise<{ posts: BlogListItem[]; total: number }> {
  if (!API_URL) return { posts: [], total: 0 };
  try {
    const res = await fetch(`${API_URL}/api/blog?limit=12&offset=0`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { posts: [], total: 0 };
    const data = (await res.json()) as { posts?: BlogListItem[]; total?: number };
    return { posts: data.posts ?? [], total: data.total ?? 0 };
  } catch {
    return { posts: [], total: 0 };
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function BlogIndexPage() {
  const { posts, total } = await getInitialPosts();

  return (
    <div className="space-y-10">
      {/* Heading */}
      <div className="space-y-4 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
          The Acadmate Blog
        </p>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          News, study tips &amp; opportunities for Nigerian students.
        </h1>
        <p className="text-slate-600 dark:text-slate-400 md:text-lg">
          UTME and Post-UTME updates, JAMB announcements, scholarship calls, school
          news, career guides — all in one place.
        </p>
      </div>

      <BlogList initialPosts={posts} initialTotal={total} />
    </div>
  );
}
