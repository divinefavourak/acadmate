import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog/", "/forum/", "/privacy", "/terms"],
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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
