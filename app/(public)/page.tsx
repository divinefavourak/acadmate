import type { Metadata } from "next";
import HomeLandingContent, {
  type RecentBlogPost,
  type SampleQuestion,
} from "./components/HomeLandingContent";
import V2Banner from "./components/V2Banner";
import { PublicSiteShell } from "@/app/components/PublicSiteShell";
import { buildMetadata, webSiteSchema, organizationSchema, SITE_NAME } from "@/lib/seo";
import { getHub, getYear, type HubData, type PublicQuestion } from "@/lib/pastQuestions";

// Numbers and the sample question come from the API; refresh hourly like the
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

/** One real question from the biggest subject's latest paper. */
async function getSample(hub: HubData | null): Promise<SampleQuestion | null> {
  const subject = [...(hub?.subjects ?? [])].sort((a, b) => b.total - a.total)[0];
  const latest = Math.max(...(subject?.years.map((y) => y.year) ?? []));
  if (!subject || !Number.isFinite(latest)) return null;
  try {
    const page = await getYear(subject.slug, latest, 1);
    const question = page?.questions.find(isShowcase);
    return question ? { subjectName: subject.name, question } : null;
  } catch {
    return null;
  }
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
    ? `Free JAMB past questions with answers: ${hub.total.toLocaleString("en-NG")} questions in ` +
      `${hub.subjects.length} subjects. Practise them in a timed CBT, get worked explanations, ` +
      `and read school news, scholarships and study tips.`
    : "Free JAMB past questions with answers. Practise them in a timed CBT, get worked explanations, " +
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
  const [sample, recentPosts] = await Promise.all([getSample(hub), getRecentBlogPosts()]);

  return (
    <PublicSiteShell active="home" banner={<V2Banner total={hub?.total} />}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationSchema(), webSiteSchema()]),
        }}
      />
      <HomeLandingContent hub={hub} sample={sample} recentPosts={recentPosts} />
    </PublicSiteShell>
  );
}
