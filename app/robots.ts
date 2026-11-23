import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getSitemapPage } from "@/lib/pastQuestions";

export const revalidate = 3600;

/** How many /sitemap-questions-N.xml files exist; 1 if the API can't say right now. */
async function questionSitemapCount(): Promise<number> {
  try {
    return (await getSitemapPage(0))?.pages ?? 1;
  } catch {
    return 1;
  }
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const questionSitemaps = Array.from(
    { length: await questionSitemapCount() },
    (_, i) => `${SITE_URL}/sitemap-questions-${i}.xml`,
  );

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog/", "/forum/", "/past-questions/", "/question/", "/privacy", "/terms"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/exam/",
          "/results/",
          "/analytics/",
          "/my-flags/",
          "/auth/",
          "/onboarding/",
          "/api/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, ...questionSitemaps],
    host: SITE_URL,
  };
}
