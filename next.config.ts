import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['10.230.215.117'],

  async rewrites() {
    return [
      // Past-question sitemaps at the site root (see app/question/sitemap.ts).
      { source: "/sitemap-questions-:id(\\d+).xml", destination: "/question/sitemap/:id.xml" },
    ];
  },
};

export default nextConfig;
