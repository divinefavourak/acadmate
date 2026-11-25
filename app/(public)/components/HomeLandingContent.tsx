import Link from "next/link";
import Image from "next/image";
import { Bricolage_Grotesque } from "next/font/google";
import { categoryLabel, type BlogCategory } from "@/app/blog/categories";
import { HUB_PATH, aboutCount, capitalise, subjectPath, yearRange, type HubData } from "@/lib/pastQuestions";
import { TryQuestion, type DemoQuestion } from "./TryQuestion";
import { PaperFinder } from "./PaperFinder";

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
const H2 = "font-display text-3xl font-extrabold tracking-tight md:text-5xl";

/**
 * Landing page body. Students land wanting a paper or a practice session, so the
 * hero opens with a paper finder and the page then lets them try a real question
 * on a CBT screen. Counts are rounded down (aboutCount) so the copy never
 * overstates and doesn't go stale. Sections with no data are left out.
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
  const count = hub ? capitalise(aboutCount(hub.total)) : null;
  const finderSubjects = subjects.map((s) => ({
    slug: s.slug,
    name: s.name,
    years: s.years.map((y) => y.year).sort((a, b) => b - a),
  }));
  const [featured, ...morePosts] = recentPosts;

  return (
    <div className={display.variable}>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        {/* The logo's blue-to-green sweep, plus a faint grid like the CBT question palette. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 -top-40 h-[38rem] w-[38rem] rounded-full bg-[conic-gradient(from_200deg,#1a91f0,#16b985,#8cd851,#1a91f0)] opacity-35 blur-3xl" />
          <div className="absolute -bottom-48 -left-32 h-[26rem] w-[26rem] rounded-full bg-brand-600/40 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        </div>

        <div className={`${WRAP} relative grid items-center gap-10 pb-28 pt-12 md:pb-36 md:pt-16 lg:grid-cols-[1.15fr_0.85fr]`}>
          <div>
            <h1 className="font-display text-[2.7rem] leading-[1.02] font-extrabold tracking-[-0.02em] sm:text-6xl md:text-7xl">
              Practise JAMB the way you’ll sit it.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-200">
              {count ? `${count} real past questions with answers, ` : "Real past questions with answers, "}
              free to read. Then practise them on a timed CBT screen and see your score straight away.
            </p>

            {finderSubjects.length > 0 && (
              <div className="mt-8 max-w-2xl">
                <PaperFinder subjects={finderSubjects} />
              </div>
            )}

            <p className="mt-5 text-slate-300">
              Ready for a timed session?{" "}
              <Link href="/register" className="font-semibold text-white underline decoration-mint-400 decoration-2 underline-offset-4 hover:decoration-white">
                Start practising free
              </Link>
            </p>
          </div>

          {/* The jubilant figure from the logo, with what's true about the site around it. */}
          <div className="relative mx-auto hidden w-full max-w-sm lg:block">
            <div aria-hidden className="absolute inset-8 rounded-full bg-white/10 ring-1 ring-white/15" />
            <Image src="/brand/mark-dark.svg" alt="" width={360} height={360} priority className="relative mx-auto h-auto w-full p-6" />
            <Badge className="absolute -left-6 top-10" tone="bg-[#feb12c] text-navy-900">
              {count ? `${count} questions` : "Real past questions"}
            </Badge>
            <Badge className="absolute -right-4 top-1/2" tone="bg-white text-navy-900">
              Answers free, no account
            </Badge>
            <Badge className="absolute bottom-6 left-2" tone="bg-mint-400 text-navy-900">
              Timed like the real CBT
            </Badge>
          </div>
        </div>
      </section>

      {/* ── WHAT DO YOU WANT TO DO: colourful tiles riding up over the hero ── */}
      <section aria-label="Ways to study" className={`${WRAP} relative -mt-16 md:-mt-20`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map((t) => (
            <li key={t.title}>
              <Link
                href={t.href}
                className={`group flex h-full items-start gap-4 rounded-2xl p-5 shadow-[0_18px_40px_-22px_rgba(13,29,47,0.6)] ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${t.tone}`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.iconTone}`}>{t.icon}</span>
                <span>
                  <span className="block font-display text-lg font-bold leading-tight text-slate-900">{t.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{t.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── TRY ONE NOW ── */}
      {questions.length > 0 && (
        <section aria-labelledby="try-heading" className={`${WRAP} grid gap-10 pt-24 md:pt-28 lg:grid-cols-[0.8fr_1.2fr] lg:items-center`}>
          <div>
            <h2 id="try-heading" className={H2}>
              Try a real question now.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              This is the screen you practise on: a clock, the question grid, and your answer marked the moment you
              pick it. The keys work like in the real CBT, too.
            </p>
            <p className="mt-4 text-sm text-slate-500">Real questions from past JAMB papers. Nothing here is saved.</p>
          </div>
          <TryQuestion questions={questions} />
        </section>
      )}

      {/* ── SUBJECTS ── */}
      {subjects.length > 0 && (
        <section aria-labelledby="subjects-heading" className={`${WRAP} pt-24 md:pt-32`}>
          <h2 id="subjects-heading" className={H2}>
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
                  {s.years.length > 0 && <span className="text-sm tabular-nums text-slate-500">{yearRange(s.years)}</span>}
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
          <h2 id="score-heading" className={H2}>
            JAMB marks you out of 400. Know where each mark comes from.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Four subjects, 100 marks each. Acadmate keeps your score in every subject and every topic inside it, so
            before exam day you know which topics will give you the most marks for the time you have left.
          </p>
        </div>
        <ResultSlip />
      </section>

      {/* ── NEWS: a featured post with its picture, the rest as thumbnail rows ── */}
      {featured && (
        <section aria-labelledby="blog-heading" className={`${WRAP} pt-24 md:pt-32`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="blog-heading" className={H2}>
              School news and study tips
            </h2>
            <Link href="/blog" className="font-semibold text-brand-600 underline underline-offset-4 dark:text-brand-400">
              All news
            </Link>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Link href={`/blog/${featured.slug}`} className="group block">
              <Cover post={featured} className="aspect-[16/9] rounded-2xl" sizes="(min-width: 1024px) 560px, 100vw" />
              <p className="mt-4 text-sm text-slate-500">
                {categoryLabel(featured.category)}, {formatDate(featured.publishedAt)}
              </p>
              <h3 className="mt-1 font-display text-2xl font-bold leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {featured.title}
              </h3>
              <p className="mt-2 text-slate-600 line-clamp-2 dark:text-slate-400">{featured.excerpt}</p>
            </Link>
            {morePosts.length > 0 && (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {morePosts.map((post) => (
                  <li key={post.id} className="py-4 first:pt-0">
                    <Link href={`/blog/${post.slug}`} className="group grid grid-cols-[7.5rem_1fr] gap-4 sm:grid-cols-[10rem_1fr]">
                      <Cover post={post} className="aspect-[4/3] rounded-xl" sizes="160px" />
                      <span>
                        <span className="block text-sm text-slate-500">
                          {categoryLabel(post.category)}, {formatDate(post.publishedAt)}
                        </span>
                        <span className="mt-1 block font-bold leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {post.title}
                        </span>
                        <span className="mt-1 hidden text-sm text-slate-600 line-clamp-2 sm:block dark:text-slate-400">
                          {post.excerpt}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ── PRICING: a comparison, so a table ── */}
      <section id="pricing" aria-labelledby="pricing-heading" className={`${WRAP} scroll-mt-24 pt-24 md:pt-32`}>
        <h2 id="pricing-heading" className={H2}>
          Free to start. Premium for everything.
        </h2>
        <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-400">
          Premium is one payment, not a subscription. Message us on WhatsApp for the current price.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-navy-900 dark:border-white/40">
                <th scope="col" className="py-3 pr-4">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-[28%] py-3 pr-4">
                  <span className="block font-display text-2xl font-extrabold">Free</span>
                  <span className="text-sm font-normal text-slate-500">₦0</span>
                </th>
                <th scope="col" className="w-[28%] py-3">
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
                  <td className="py-3.5 pr-4">
                    <Cell value={free} />
                  </td>
                  <td className="py-3.5">
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
          <Image src="/brand/logo-dark.svg" alt="Acadmate" width={220} height={220} className="mx-auto h-44 w-auto md:h-56" />
          <div>
            <h2 className={H2}>Start with one subject and twenty questions.</h2>
            <p className="mt-4 max-w-xl text-lg text-slate-300">
              That’s a first practice session. Create a free account and you can sit one right now.
            </p>
            <Link href="/register" className="mt-7 inline-block rounded-lg bg-white px-6 py-3.5 font-bold text-navy-900 hover:bg-brand-50">
              Start practising free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const TILES = [
  {
    title: "Past questions",
    text: "Read papers by subject and year, with answers.",
    href: HUB_PATH,
    tone: "bg-[#fff4dc]",
    iconTone: "bg-[#feb12c] text-navy-900",
    icon: icon("M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5ZM8 7h7M8 11h5"),
  },
  {
    title: "CBT practice",
    text: "Timed sessions, marked straight away.",
    href: "/register",
    tone: "bg-[#e3f1ff]",
    iconTone: "bg-brand-600 text-white",
    icon: icon("M3 4h18v12H3zM8 20h8M12 16v4M7 8h4M7 11h7"),
  },
  {
    title: "Topic drills",
    text: "Work on one topic until it sticks.",
    href: "/register",
    tone: "bg-[#dcf8ec]",
    iconTone: "bg-mint-600 text-white",
    icon: icon("M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6M12 10a2 2 0 1 0 2 2M12 12l9-9"),
  },
  {
    title: "Literature guide",
    text: "Summaries and characters for the UTME novel.",
    href: "/register",
    tone: "bg-[#efe9ff]",
    iconTone: "bg-[#7c5cff] text-white",
    icon: icon("M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"),
  },
];

// A cell is a tick, a dash, a tick with a note ("Limited"), or plain text.
type CellValue = true | false | { tick: true; note: string } | string;

const PLAN_ROWS: [string, CellValue, CellValue][] = [
  ["Past questions with answers", true, true],
  ["Worked explanations", true, true],
  ["CBT practice by subject and topic", { tick: true, note: "Limited" }, { tick: true, note: "Unlimited" }],
  ["Study notes", { tick: true, note: "Limited" }, { tick: true, note: "All topics" }],
  ["Full UTME mock: four subjects, two hours", false, true],
  ["Scores, analytics and leaderboard", true, true],
  ["Literature guide", true, true],
  ["Email alerts for new posts", false, true],
  ["WhatsApp support", false, "Priority"],
];

function Tick() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" className="shrink-0 text-mint-600" role="img" aria-label="Included">
      <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <Tick />;
  if (value === false)
    return (
      <span className="text-slate-400" aria-label="Not included">
        –
      </span>
    );
  if (typeof value === "object")
    return (
      <span className="inline-flex items-center gap-2">
        <Tick />
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            value.note === "Limited"
              ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-mint-100 text-mint-800 dark:bg-mint-500/15 dark:text-mint-300"
          }`}
        >
          {value.note}
        </span>
      </span>
    );
  return <span className="text-sm text-slate-700 dark:text-slate-300">{value}</span>;
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Badge({ children, className, tone }: { children: React.ReactNode; className: string; tone: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold shadow-lg shadow-black/25 ${tone} ${className}`}>
      {children}
    </span>
  );
}

/** A post's cover picture, or the brand mark on a tint when the post has none. */
function Cover({ post, className, sizes }: { post: RecentBlogPost; className: string; sizes: string }) {
  return (
    <span className={`relative block overflow-hidden bg-slate-100 dark:bg-slate-800 ${className}`}>
      {post.coverImageUrl ? (
        // Covers are on Cloudinary at assorted sizes; a plain img keeps them uncropped by the optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt=""
          loading="lazy"
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-brand-100 to-mint-100 dark:from-brand-900/40 dark:to-mint-900/30">
          <Image src="/brand/mark.svg" alt="" width={56} height={56} className="opacity-70" />
        </span>
      )}
    </span>
  );
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
