import type { Metadata } from "next";
import HomeLandingContent, { type RecentBlogPost } from "./components/HomeLandingContent";
import type { DemoQuestion } from "./components/TryQuestion";
import V2Banner from "./components/V2Banner";
import { PublicSiteShell } from "@/app/components/PublicSiteShell";
import { buildMetadata, webSiteSchema, organizationSchema, SITE_NAME } from "@/lib/seo";
import { getHub, getYear, aboutCount, type HubData, type PublicQuestion } from "@/lib/pastQuestions";

// Counts and the demo questions come from the API; refresh hourly like the
// past-question pages they describe.
export const revalidate = 3600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Data ────────────────────────────────────────────────────────────────────

/** The landing page must render even if the API is down, so failures become null. */
async function safeHub(): Promise<HubData | null> {
  try {
    return await getHub();
  } catch {
    return null;
  }
}

/** A question that reads well as plain text in the hero: no picture, no maths markup, short. */
function isShowcase(q: PublicQuestion): boolean {
  return (
    !q.imageUrl &&
    !q.proseText &&
    q.text === q.plainText &&
    q.plainText.length >= 30 &&
    q.plainText.length <= 170 &&
    q.options.length > 0 &&
    q.options.every((o) => o.text === o.plainText && o.plainText.length <= 50)
  );
}

const DEMO_SUBJECTS = 5;

/**
 * Questions for the hero CBT demo: one from the latest paper of each of the
 * biggest subjects, so the demo shows the range. Subjects with no plain-text
 * question on that page are skipped.
 */
async function getDemoQuestions(hub: HubData | null): Promise<DemoQuestion[]> {
  const subjects = [...(hub?.subjects ?? [])].sort((a, b) => b.total - a.total).slice(0, DEMO_SUBJECTS);
  const picked = await Promise.all(
    subjects.map(async (subject): Promise<DemoQuestion | null> => {
      const latest = Math.max(...subject.years.map((y) => y.year));
      if (!Number.isFinite(latest)) return null;
      try {
        const q = (await getYear(subject.slug, latest, 1))?.questions.find(isShowcase);
        return q
          ? {
              slug: q.slug,
              subjectName: subject.name,
              year: q.year,
              text: q.plainText,
              options: q.options.map((o) => ({ label: o.label, text: o.plainText })),
              answer: q.answer,
            }
          : null;
      } catch {
        return null;
      }
    }),
  );
  return picked.filter((q): q is DemoQuestion => q !== null);
}

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

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const hub = await safeHub();
  const description = hub
    ? `Free JAMB past questions with answers: ${aboutCount(hub.total)} questions in ` +
      `${hub.subjects.length} subjects. Practise them on a timed CBT, get worked explanations, ` +
      `and read school news, scholarships and study tips.`
    : "Free JAMB past questions with answers. Practise them on a timed CBT, get worked explanations, " +
      "and read school news, scholarships and study tips.";
  return {
    ...buildMetadata({
      title: `${SITE_NAME}: JAMB Past Questions with Answers and Free CBT Practice`,
      titleTemplate: false,
      description,
      path: "/",
      type: "website",
    }),
    title: { absolute: `${SITE_NAME}: JAMB Past Questions with Answers and Free CBT Practice` },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const hub = await safeHub();
  const [questions, recentPosts] = await Promise.all([getDemoQuestions(hub), getRecentBlogPosts()]);

  return (
    <PublicSiteShell active="home" bleed banner={<V2Banner count={hub ? aboutCount(hub.total) : undefined} />}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationSchema(), webSiteSchema()]),
        }}
      />
      <HomeLandingContent hub={hub} questions={questions} recentPosts={recentPosts} />
    </PublicSiteShell>
  );
}
