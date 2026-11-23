import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getSitemapPage, questionPath } from "@/lib/pastQuestions";

export const revalidate = 3600;

/**
 * One sitemap per 5,000 past questions. Next serves them at
 * /question/sitemap/[id].xml, and next.config rewrites
 * /sitemap-questions-[id].xml to them. The root-level name is what robots.txt
 * lists and what goes into Search Console, because the sitemap protocol only
 * lets a sitemap list URLs under its own directory.
 */
export async function generateSitemaps() {
  const first = await getSitemapPage(0);
  return Array.from({ length: first?.pages ?? 1 }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const page = await getSitemapPage(id);
  return (page?.items ?? []).map((q) => ({
    url: `${SITE_URL}${questionPath(q.slug)}`,
    lastModified: new Date(q.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
