import Link from "next/link";
import Image from "next/image";
import { Bricolage_Grotesque } from "next/font/google";
import { categoryLabel, type BlogCategory } from "@/app/blog/categories";
import { HUB_PATH, roughCount, subjectPath, yearRange, type HubData } from "@/lib/pastQuestions";
import { TryQuestion, type DemoQuestion } from "./TryQuestion";

// Headline face for the landing page only. Chunky and a little quirky, close to
// the weight of the logo's wordmark; body text stays in the site's Outfit.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });

export interface RecentBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: BlogCategory;
  publishedAt: string;
  author: { name: string | null } | null;
}

const WHATSAPP_URL = "https://wa.me/2349031843486";
const WRAP = "mx-auto w-full max-w-6xl px-4 md:px-6";

/**
 * Landing page body. Built around the thing students will actually do here,
 * answering past questions on a CBT screen, so the hero is a working one.
 * Counts are rounded down (roughCount) so the copy never overstates and doesn't
 * go stale with every published batch. Sections with no data are left out.
 */
export default function HomeLandingContent({
  hub,
  questions,
  recentPosts = [],
}: {
  hub: HubData | null;
  questions: DemoQuestion[];
  recentPosts?: RecentBlogPost[];
}) {
  const subjects = hub?.subjects ?? [];
  const count = hub ? roughCount(hub.total) : null;

  return (
    <div className={display.variable}>
      {/* ── HERO: the CBT screen, sitting across the navy band ── */}
      <section className="bg-navy-900 text-white">
        <div className={`${WRAP} pt-14 md:pt-20 ${questions.length ? "pb-44 md:pb-52" : "pb-20"}`}>
          <h1 className="font-display max-w-4xl text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.02em] sm:text-6xl md:text-7xl">
            Practise JAMB the way you’ll sit it.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            {count ? `Over ${count} real past questions, ` : "Real past questions, "}
            free to read with their answers. Here you answer them on a CBT screen like the one below, get marked
            straight away, and find the topics that are costing you marks.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-lg bg-white px-6 py-3.5 text-center font-bold text-navy-900 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start practising free
            </Link>
            <Link
              href={HUB_PATH}
              className="rounded-lg border-2 border-white/25 px-6 py-3 text-center font-semibold hover:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse past questions
            </Link>
          </div>
        </div>
      </section>

      {questions.length > 0 && (
        <div className={`${WRAP} -mt-36 md:-mt-40`}>
          <div className="mx-auto max-w-4xl">
            <TryQuestion questions={questions} />
            <p className="mt-3 text-sm text-slate-500">
              Real questions from past JAMB papers. Nothing you answer here is saved.
            </p>
          </div>
        </div>
      )}

      {/* ── SUBJECTS: a run of big names, not a grid of cards ── */}
      {subjects.length > 0 && (
        <section aria-labelledby="subjects-heading" className={`${WRAP} pt-24 md:pt-32`}>
          <h2 id="subjects-heading" className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
            Past questions by subject
          </h2>
          <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-400">
            Every question shows its answer, no account needed. Sign in free to read the worked explanation.
          </p>
          <ul className="mt-10 flex flex-wrap items-baseline gap-x-10 gap-y-6">
            {subjects.map((s) => (
              <li key={s.id}>
                <Link href={subjectPath(s.slug)} className="group inline-flex items-baseline gap-2.5">
                  <span className="font-display text-3xl font-bold tracking-tight decoration-brand-500 decoration-[3px] underline-offset-[6px] group-hover:underline md:text-5xl">
                    {s.name}
                  </span>
                  {s.years.length > 0 && (
                    <span className="text-sm tabular-nums text-slate-500">{yearRange(s.years)}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-slate-600 dark:text-slate-400">
            More papers and subjects are being checked and added.{" "}
            <Link href={HUB_PATH} className="font-semibold text-brand-600 underline underline-offset-4 dark:text-brand-400">
              See every paper by year
            </Link>
          </p>
        </section>
      )}

      {/* ── THE 400 ── */}
      <section aria-labelledby="score-heading" className={`${WRAP} grid items-center gap-12 pt-24 md:grid-cols-2 md:pt-32`}>
        <div>
          <h2 id="score-heading" className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
            JAMB marks you out of 400. Know where each mark comes from.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Four subjects, 100 marks each. Acadmate keeps your score in every subject and every topic inside it, so
            before exam day you know which topics will give you the most marks for the time you have left.
          </p>
        </div>
        <ResultSlip />
      </section>

      {/* ── BLOG ── */}
      {recentPosts.length > 0 && (
        <section aria-labelledby="blog-heading" className={`${WRAP} pt-24 md:pt-32`}>
          <h2 id="blog-heading" className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
            School news, scholarships and study tips
          </h2>
          <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-400">
            JAMB updates, admission news and funding calls, written for Nigerian students.
          </p>
          <ul className="mt-8 divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
            {recentPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group grid gap-1 py-5 md:grid-cols-[11rem_1fr] md:gap-8"
                >
                  <span className="text-sm text-slate-500">
                    {categoryLabel(post.category)}, {formatDate(post.publishedAt)}
                  </span>
                  <span>
                    <span className="block text-lg font-bold leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {post.title}
                    </span>
                    <span className="mt-1 block text-slate-600 line-clamp-2 dark:text-slate-400">{post.excerpt}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            <Link href="/blog" className="font-semibold text-brand-600 underline underline-offset-4 dark:text-brand-400">
              Read the blog
            </Link>
            <span className="text-slate-400"> or </span>
            <Link href="/forum" className="font-semibold text-brand-600 underline underline-offset-4 dark:text-brand-400">
              ask in the forum
            </Link>
          </p>
        </section>
      )}

      {/* ── PRICING: a comparison, so a table ── */}
      <section id="pricing" aria-labelledby="pricing-heading" className={`${WRAP} scroll-mt-24 pt-24 md:pt-32`}>
        <h2 id="pricing-heading" className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
          Free to start. Premium when you want the full mock.
        </h2>
        <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-400">
          Premium is one payment, not a subscription. Message us on WhatsApp for the current price.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-navy-900 dark:border-white/40">
                <th scope="col" className="py-3 pr-4 font-normal text-slate-500">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-1/4 py-3 pr-4">
                  <span className="block font-display text-2xl font-extrabold">Free</span>
                  <span className="text-sm font-normal text-slate-500">₦0</span>
                </th>
                <th scope="col" className="w-1/4 py-3">
                  <span className="block font-display text-2xl font-extrabold text-brand-600 dark:text-brand-400">Premium</span>
                  <span className="text-sm font-normal text-slate-500">One payment</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ROWS.map(([feature, free, premium]) => (
                <tr key={feature} className="border-b border-black/10 dark:border-white/10">
                  <th scope="row" className="py-3.5 pr-4 font-medium">
                    {feature}
                  </th>
                  <td className="py-3.5 pr-4 text-slate-700 dark:text-slate-300">
                    <Cell value={free} />
                  </td>
                  <td className="py-3.5 text-slate-700 dark:text-slate-300">
                    <Cell value={premium} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/register" className="rounded-lg bg-brand-600 px-6 py-3.5 text-center font-bold text-white hover:bg-brand-700">
            Create free account
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border-2 border-black/15 px-6 py-3 text-center font-semibold hover:border-brand-600 dark:border-white/20"
          >
            Ask about Premium on WhatsApp
          </a>
        </div>
      </section>

      {/* ── CLOSE: the figure from the logo ── */}
      <section className="mt-24 bg-navy-900 text-white md:mt-32">
        <div className={`${WRAP} grid items-center gap-10 py-16 md:grid-cols-[auto_1fr] md:py-20`}>
          <Image
            src="/brand/logo-dark.svg"
            alt="Acadmate"
            width={220}
            height={220}
            className="mx-auto h-44 w-auto md:h-56"
          />
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
              Start with one subject and twenty questions.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-slate-300">
              That’s a first practice session. Create a free account and you can sit one right now.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-block rounded-lg bg-white px-6 py-3.5 font-bold text-navy-900 hover:bg-brand-50"
            >
              Start practising free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

type CellValue = boolean | string;

const PLAN_ROWS: [string, CellValue, CellValue][] = [
  ["Past questions with answers", true, true],
  ["Worked explanations", true, true],
  ["Subject and topic practice", "Up to 20 questions a session", "Any length"],
  ["Full UTME mock: four subjects, two hours", false, true],
  ["Scores, analytics and leaderboard", true, true],
  ["Literature guide", true, true],
  ["WhatsApp support", false, "Priority"],
];

function Cell({ value }: { value: CellValue }) {
  if (value === true)
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" className="text-mint-600" role="img" aria-label="Included">
        <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="m4.5 10.5 3.5 3.5 7.5-8" />
      </svg>
    );
  if (value === false)
    return (
      <span className="text-slate-400" aria-label="Not included">
        –
      </span>
    );
  return <span className="text-sm">{value}</span>;
}

/** A made-up practice result laid out like a result slip, to show what the analytics track. */
function ResultSlip() {
  const rows = [
    { subject: "Use of English", score: 71 },
    { subject: "Physics", score: 64 },
    { subject: "Chemistry", score: 52 },
    { subject: "Mathematics", score: 69 },
  ];
  const total = rows.reduce((t, r) => t + r.score, 0);
  return (
    <figure className="rotate-[-1.2deg] rounded-md border border-black/10 bg-white p-6 text-slate-900 shadow-[0_20px_50px_-24px_rgba(13,29,47,0.45)] md:p-8">
      <div className="flex items-baseline justify-between border-b-2 border-dashed border-slate-300 pb-3">
        <span className="font-display text-lg font-bold">Practice results</span>
        <span className="text-sm text-slate-500">Example</span>
      </div>
      <dl className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.subject} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <dt>{r.subject}</dt>
            <dd className="h-2 rounded-full bg-slate-100" aria-hidden>
              <span
                className={`block h-full rounded-full ${r.score < 60 ? "bg-[#feb12c]" : "bg-brand-600"}`}
                style={{ width: `${r.score}%` }}
              />
            </dd>
            <dd className="text-right font-semibold tabular-nums">{r.score}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t-2 border-slate-900 pt-3">
        <span className="font-semibold">Total</span>
        <span className="font-display text-4xl font-extrabold tabular-nums">
          {total}
          <span className="text-lg font-bold text-slate-400">/400</span>
        </span>
      </div>
      <figcaption className="mt-4 rounded bg-[#fff6e5] px-3 py-2 text-sm text-amber-900">
        Weakest topic: Organic chemistry. 6 of 14 right.
      </figcaption>
    </figure>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
