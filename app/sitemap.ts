import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Fetch helpers ───────────────────────────────────────────────────────────

interface BlogPostSummary {
  slug: string;
  publishedAt: string;
  updatedAt: string;
}

interface ForumThreadSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/blog?limit=500&offset=0`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { posts?: BlogPostSummary[] };
    return data.posts ?? [];
  } catch {
    return [];
  }
}

async function fetchPublicForumThreads(): Promise<ForumThreadSummary[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/forum?limit=500&offset=0`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { threads?: ForumThreadSummary[] };
    return data.threads ?? [];
  } catch {
    return [];
  }
}

// ─── Sitemap ─────────────────────────────────────────────────────────────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [blogPosts, forumThreads] = await Promise.all([
    fetchPublishedBlogPosts(),
    fetchPublicForumThreads(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/forum`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-05-31"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date("2026-05-31"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const blogPostRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const forumThreadRoutes: MetadataRoute.Sitemap = forumThreads.map((t) => ({
    url: `${SITE_URL}/forum/${t.id}`,
    lastModified: new Date(t.updatedAt ?? t.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...blogPostRoutes, ...forumThreadRoutes];
}
