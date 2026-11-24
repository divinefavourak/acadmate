import type { Metadata } from "next";
import { PublicSiteShell } from "@/app/components/PublicSiteShell";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: `Forum | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME} Forum`,
  },
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteShell active="forum">{children}</PublicSiteShell>;
}
