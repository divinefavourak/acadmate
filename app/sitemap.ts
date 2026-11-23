import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { HUB_PATH, YEAR_PAGE_SIZE, getHub, subjectPath, yearPath } from "@/lib/pastQuestions";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const PAGE_SIZE = 500;
const MAX_PAGES = 100; // 100 × 500 = 50 000 — the sitemap protocol's per-file URL limit

// ─── Fetch helpers ───────────────────────────────────────────────────────────

interface BlogPostSummary {
  slug: string;
  publishedAt: string;
  updatedAt?: string;
}

interface ForumThreadSummary {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

async function paginate<T>(
  buildUrl: (offset: number) => string,
  extract: (body: unknown) => T[] | undefined,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const res = await fetch(buildUrl(offset), { next: { revalidate: 3600 } });
      if (!res.ok) break;
      const page = extract(await res.json()) ?? [];
      results.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch {}
  return results;
}

async function fetchPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  if (!API_URL) return [];
  return paginate(
    (offset) => `${API_URL}/api/blog?limit=${PAGE_SIZE}&offset=${offset}`,
    (d) => (d as { posts?: BlogPostSummary[] }).posts,
  );
}

async function fetchPublicForumThreads(): Promise<ForumThreadSummary[]> {
  if (!API_URL) return [];
  return paginate(
    (offset) => `${API_URL}/api/forum?limit=${PAGE_SIZE}&offset=${offset}`,
    (d) => (d as { threads?: ForumThreadSummary[] }).threads,
  );
}

/**
 * Hub, subject and year pages. Individual questions are in their own
 * sitemaps (/sitemap-questions-N.xml, see app/question/sitemap.ts).
 */
async function pastQuestionRoutes(): Promise<MetadataRoute.Sitemap> {
  let hub;
  try {
    hub = await getHub();
  } catch {
    return [];
  }
  const routes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}${HUB_PATH}`, changeFrequency: "weekly", priority: 0.9 },
  ];
  for (const s of hub.subjects) {
    routes.push({ url: `${SITE_URL}${subjectPath(s.slug)}`, changeFrequency: "weekly", priority: 0.8 });
    for (const y of s.years) {
      const pages = Math.ceil(y.count / YEAR_PAGE_SIZE);
      for (let page = 1; page <= pages; page++) {
        routes.push({
          url: `${SITE_URL}${yearPath(s.slug, y.year, page)}`,
          changeFrequency: "monthly",
          priority: page === 1 ? 0.7 : 0.5,
        });
      }
    }
  }
  return routes;
}

// ─── Sitemap ─────────────────────────────────────────────────────────────────

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [blogPosts, forumThreads, pastQuestions] = await Promise.all([
    fetchPublishedBlogPosts(),
    fetchPublicForumThreads(),
    pastQuestionRoutes(),
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

  return [...staticRoutes, ...pastQuestions, ...blogPostRoutes, ...forumThreadRoutes];
}
