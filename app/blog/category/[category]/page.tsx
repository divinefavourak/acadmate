import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { categoryLabel, type BlogCategory } from "../../categories";
import { FeaturedCard, PostCard, type BlogListItem } from "../../components/BlogList";

// ─── ISR ─────────────────────────────────────────────────────────────────────

export const revalidate = 300;

// ─── Category config ──────────────────────────────────────────────────────────

/**
 * URL slug → DB enum + SEO copy.
 * Each entry becomes an independently indexable page at /blog/category/<slug>.
 */
const CATEGORY_CONFIG: Record<
  string,
  {
    enum: BlogCategory;
    headline: string;
    description: string;
    keywords: string[];
  }
> = {
  utme: {
    enum: "UTME",
    headline: "UTME News & Updates",
    description:
      "Latest UTME news, registration deadlines, result releases, and preparation guides for Nigerian students sitting the Unified Tertiary Matriculation Examination.",
    keywords: ["UTME news", "UTME registration", "UTME results", "UTME 2025"],
  },
  "post-utme": {
    enum: "POST_UTME",
    headline: "Post-UTME Guides & Updates",
    description:
      "Post-UTME screening news, cut-off marks, past questions, and preparation tips for UNILAG, UI, OAU, UNIBEN, ABU and UNN.",
    keywords: [
      "Post-UTME past questions",
      "Post-UTME UNILAG",
      "Post-UTME UI",
      "Post-UTME screening",
    ],
  },
  jamb: {
    enum: "JAMB",
    headline: "JAMB News & Announcements",
    description:
      "Official JAMB announcements, CBT centre updates, syllabus changes, and everything you need to know about the Joint Admissions and Matriculation Board.",
    keywords: ["JAMB news", "JAMB announcements", "JAMB 2025", "JAMB CBT"],
  },
  "school-news": {
    enum: "SCHOOL_NEWS",
    headline: "Nigerian University News",
    description:
      "Latest news from Nigerian universities — resumption dates, strike updates, admission lists, and campus announcements.",
    keywords: [
      "Nigerian university news",
      "UNILAG news",
      "admission list 2025",
      "university resumption",
    ],
  },
  "study-tips": {
    enum: "STUDY_TIPS",
    headline: "Study Tips & Exam Strategies",
    description:
      "Practical study techniques, time management strategies, and exam preparation advice to help Nigerian students score higher in JAMB and Post-UTME.",
    keywords: [
      "how to pass JAMB",
      "JAMB study tips",
      "exam preparation Nigeria",
      "CBT practice tips",
    ],
  },
  scholarships: {
    enum: "SCHOLARSHIPS",
    headline: "Scholarships for Nigerian Students",
    description:
      "Local and international scholarship opportunities for Nigerian students — fully-funded, partial grants, and government bursaries. Never miss a funding deadline.",
    keywords: [
      "scholarships Nigeria 2025",
      "Nigerian student scholarships",
      "fully-funded scholarships Nigeria",
      "university grants Nigeria",
    ],
  },
  career: {
    enum: "CAREER",
    headline: "Career & Course Guidance",
    description:
      "Career path guides, course requirements, professional certifications, and university admission insights to help Nigerian students plan their futures.",
    keywords: [
      "career advice Nigeria",
      "best courses in Nigeria",
      "university admission requirements",
      "career paths for Nigerian students",
    ],
  },
  announcement: {
    enum: "ANNOUNCEMENT",
    headline: "Acadmate Announcements",
    description:
      "Official announcements from Acadmate — new features, platform updates, and important notices for our students.",
    keywords: ["Acadmate updates", "new features", "platform announcements"],
  },
  general: {
    enum: "GENERAL",
    headline: "General Articles",
    description:
      "General educational articles, student advice, and guides for Nigerian secondary-school leavers and university students.",
    keywords: ["Nigerian student advice", "educational articles Nigeria"],
  },
};

export function generateStaticParams() {
  return Object.keys(CATEGORY_CONFIG).map((slug) => ({ category: slug }));
}

// ─── Data fetching ────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getCategoryPosts(
  categoryEnum: BlogCategory,
): Promise<{ posts: BlogListItem[]; total: number }> {
  if (!API_URL) return { posts: [], total: 0 };
  try {
    const res = await fetch(
      `${API_URL}/api/blog?limit=24&offset=0&category=${categoryEnum}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return { posts: [], total: 0 };
    const data = (await res.json()) as {
      posts?: BlogListItem[];
      total?: number;
    };
    return { posts: data.posts ?? [], total: data.total ?? 0 };
  } catch {
    return { posts: [], total: 0 };
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const config = CATEGORY_CONFIG[category];
  if (!config) return { title: "Category Not Found" };

  return buildMetadata({
    title: config.headline,
    description: config.description,
    path: `/blog/category/${category}`,
  });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const config = CATEGORY_CONFIG[category];
  if (!config) notFound();

  const { posts } = await getCategoryPosts(config.enum);
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="space-y-10">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
      >
        <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/blog" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Blog
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium">
          {categoryLabel(config.enum)}
        </span>
      </nav>

      {/* Heading */}
      <div className="space-y-3 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
          {categoryLabel(config.enum)}
        </p>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          {config.headline}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 md:text-lg">
          {config.description}
        </p>
      </div>

      {/* All categories — quick nav */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/blog"
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
        >
          All
        </Link>
        {Object.entries(CATEGORY_CONFIG).map(([slug, cfg]) => (
          <Link
            key={slug}
            href={`/blog/category/${slug}`}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              slug === category
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
            }`}
          >
            {categoryLabel(cfg.enum)}
          </Link>
        ))}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-12 text-center space-y-2">
          <p className="text-slate-700 dark:text-slate-300 font-medium">No posts yet in this category.</p>
          <p className="text-slate-500 text-sm">Check back soon — we publish regularly.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {featured && <FeaturedCard post={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
