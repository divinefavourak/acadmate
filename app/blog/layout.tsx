import type { Metadata } from "next";
import { PublicSiteShell } from "@/app/components/PublicSiteShell";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: `Blog | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME} Blog`,
  },
  openGraph: { type: "article" },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteShell active="blog">{children}</PublicSiteShell>;
}
