import type { Metadata } from "next";
import HomeLandingContent, {
  type RecentBlogPost,
} from "./components/HomeLandingContent";
import {
  buildMetadata,
  webSiteSchema,
  organizationSchema,
} from "@/lib/seo";

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Free JAMB/UTME CBT Practice & Post-UTME Past Questions in Nigeria",
    titleTemplate: false,
    description:
      "Acadmate offers free JAMB/UTME CBT practice with 8,600+ past questions across 11 subjects, Post-UTME papers for UNILAG, UI, OAU, UNIBEN, ABU and UNN. " +
      "Nigeria's #1 student exam prep platform — start practising free today.",
    path: "/",
    type: "website",
  }),
  title:
    "Acadmate – Free JAMB/UTME CBT Practice & Post-UTME Past Questions in Nigeria",
};

// ─── Data fetching ────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getRecentBlogPosts(): Promise<RecentBlogPost[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/api/blog?limit=3`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { posts?: RecentBlogPost[] };
    return data.posts ?? [];
  } catch {
    return [];
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const recentPosts = await getRecentBlogPosts();

  return (
    <>
      {/* JSON-LD: Organization + WebSite schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationSchema(), webSiteSchema()]),
        }}
      />
      <HomeLandingContent recentPosts={recentPosts} />
    </>
  );
}
