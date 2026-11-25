import Link from "next/link";
import { categoryLabel, type BlogCategory } from "@/app/blog/categories";
import {
  HUB_PATH,
  questionPath,
  subjectPath,
  yearRange,
  type HubData,
  type PublicQuestion,
} from "@/lib/pastQuestions";

// ─── Types ───────────────────────────────────────────────────────────────────

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

/** A real question from the bank, shown in the hero as a preview of the product. */
export interface SampleQuestion {
  subjectName: string;
  question: PublicQuestion;
}

const WHATSAPP_URL = "https://wa.me/2349031843486";

const nf = (n: number) => n.toLocaleString("en-NG");

/**
 * Landing page body. Every number on it comes from the public past-questions
 * API (see app/(public)/page.tsx), so it can't drift from what's live. If the
 * API is down at build time, the number blocks are left out rather than guessed.
 */
export default function HomeLandingContent({
  hub,
  sample,
  recentPosts = [],
}: {
  hub: HubData | null;
  sample: SampleQuestion | null;
  recentPosts?: RecentBlogPost[];
}) {
  const subjects = hub?.subjects ?? [];
  const allYears = subjects.flatMap((s) => s.years);
  const papers = allYears.length;

  return (
    <div className="space-y-24 md:space-y-32">
      {/* ── HERO ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center pt-2 md:pt-6">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 mb-6">
            JAMB past questions · CBT practice
          </p>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            JAMB past questions,{" "}
            <span className="bg-linear-to-r from-brand-500 to-mint-500 dark:from-brand-400 dark:to-mint-400 bg-clip-text text-transparent">
              with answers.
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
            {hub
              ? `${nf(hub.total)} real questions from ${papers} past papers, free to read with no account. `
              : "Real questions from past papers, free to read with no account. "}
            Sign up to practise them in a timed CBT, see worked explanations, and find your weak topics before
            exam day.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="text-center bg-brand-600 hover:bg-brand-700 text-white font-bold px-7 py-3.5 rounded-xl transition-colors"
            >
              Start practising free
            </Link>
            <Link
              href={HUB_PATH}
              className="text-center border border-black/10 dark:border-white/15 hover:border-brand-500/50 font-semibold px-7 py-3.5 rounded-xl transition-colors"
            >
              Browse past questions
            </Link>
          </div>

          {hub && (
            <dl className="mt-10 pt-6 border-t border-black/5 dark:border-white/10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { val: nf(hub.total), label: "Questions" },
                { val: String(subjects.length), label: "Subjects" },
                { val: allYears.length ? yearRange(allYears) : String(papers), label: allYears.length ? "Papers from" : "Papers" },
              ].map((s) => (
                // dt must come first in the markup; flex-col-reverse shows the number on top.
                <div key={s.label} className="flex flex-col-reverse">
                  <dt className="text-xs text-slate-500 mt-0.5">{s.label}</dt>
                  <dd className="text-2xl font-extrabold tracking-tight">{s.val}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {sample ? <SampleCard sample={sample} /> : <CbtSketch />}
      </section>

      {/* ── SUBJECTS ── */}
      {subjects.length > 0 && (
        <section aria-labelledby="subjects-heading">
          <SectionHeading
            id="subjects-heading"
            kicker="Free to read"
            title="Pick a subject"
            text="Every question has its correct answer on the page. Sign in free for the worked explanation."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <li key={s.id}>
                <Link
                  href={subjectPath(s.slug)}
                  className="group flex h-full flex-col rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-5 hover:border-brand-500/40 transition-colors"
                >
                  <span className="text-lg font-bold group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    JAMB {s.name}
                  </span>
                  <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {nf(s.total)} questions · {s.years.length} {s.years.length === 1 ? "paper" : "papers"}
                    {s.years.length > 0 && ` · ${yearRange(s.years)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate-500">More subjects are being checked and added.</p>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section aria-labelledby="how-heading">
        <SectionHeading id="how-heading" kicker="How it works" title="Read, practise, improve" />
        <ol className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Read past questions",
              text: "Browse by subject and year. Try each question, then open the answer. No account needed.",
            },
            {
              title: "Practise like the real CBT",
              text: "Timed sessions on screen, the way JAMB sets them. Practise a whole subject or one topic at a time.",
            },
            {
              title: "Fix your weak topics",
              text: "Every session is marked straight away. Your analytics show which topics cost you marks.",
            },
          ].map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-black/5 dark:border-white/10 p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── MORE THAN EXAMS ── */}
      <section aria-labelledby="more-heading">
        <SectionHeading
          id="more-heading"
          kicker="Beyond the exam"
          title="Everything else a student needs"
          text="Exam prep is where it starts. Acadmate also covers the news, money and plans around it."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Worked explanations", text: "Step-by-step reasons for each answer, when you sign in.", href: HUB_PATH },
            { title: "Literature guide", text: "Summaries and characters for the UTME prose text.", href: "/register" },
            { title: "School news and scholarships", text: "JAMB updates, admission news and funding calls.", href: "/blog" },
            { title: "Student forum", text: "Ask questions and help other candidates.", href: "/forum" },
          ].map((f) => (
            <li key={f.title}>
              <Link
                href={f.href}
                className="block h-full rounded-2xl border border-black/5 dark:border-white/10 p-5 hover:border-brand-500/40 transition-colors"
              >
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-24">
        <SectionHeading
          id="pricing-heading"
          kicker="Pricing"
          title="Free to start. Pay once for more."
          center
        />
        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          <PlanCard
            name="Free"
            price="₦0"
            note="No card, no trial period."
            items={[
              "Every past question and answer",
              "Worked explanations",
              "Practice and topic sessions, up to 20 questions each",
              "Scores, analytics and leaderboard",
              "Literature guide",
            ]}
            cta={{ href: "/register", label: "Create free account" }}
          />
          <PlanCard
            featured
            name="Premium"
            price="Ask on WhatsApp"
            note="Pay once for full access. No subscription."
            items={[
              "Everything in Free",
              "Full UTME mock exams: four subjects, two hours",
              "As many questions per session as you want",
              "Priority WhatsApp support",
            ]}
            cta={{ href: WHATSAPP_URL, label: "Message us on WhatsApp", external: true }}
          />
        </div>
      </section>

      {/* ── LATEST FROM THE BLOG ── */}
      {recentPosts.length > 0 && (
        <section aria-labelledby="blog-heading">
          <div className="flex items-end justify-between gap-4 mb-8">
            <SectionHeading id="blog-heading" kicker="The Acadmate blog" title="News, tips and opportunities" flush />
            <Link href="/blog" className="hidden sm:inline-flex shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              All posts →
            </Link>
          </div>
          <ul className="grid gap-5 md:grid-cols-3">
            {recentPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 hover:border-brand-500/40 transition-colors"
                >
                  <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-900">
                    {post.coverImageUrl ? (
                      // Cover images are on Cloudinary at arbitrary sizes, so a plain img keeps their aspect.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.coverImageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="h-full w-full bg-linear-to-br from-brand-600/20 to-mint-600/10" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
                      {categoryLabel(post.category)}
                    </span>
                    <h3 className="font-bold leading-snug">{post.title}</h3>
                    <p className="flex-1 text-sm text-slate-500 line-clamp-2">{post.excerpt}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── CLOSING CTA ── */}
      <section className="rounded-3xl bg-navy-900 px-6 py-12 md:p-16 text-center text-white relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-mint-500/25 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Start with one subject today.</h2>
          <p className="mt-4 text-lg text-slate-300 max-w-xl mx-auto">
            Create a free account, pick a subject, and take your first timed session in under a minute.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/register" className="bg-white text-navy-900 font-bold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-colors">
              Create free account
            </Link>
            <Link href="/login" className="border border-white/20 font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function SectionHeading({
  id,
  kicker,
  title,
  text,
  center = false,
  flush = false,
}: {
  id: string;
  kicker: string;
  title: string;
  text?: string;
  center?: boolean;
  flush?: boolean;
}) {
  return (
    <div className={`${flush ? "" : "mb-8"} ${center ? "text-center mx-auto" : ""} max-w-2xl`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">{kicker}</p>
      <h2 id={id} className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
        {title}
      </h2>
      {text && <p className="mt-3 text-slate-600 dark:text-slate-400">{text}</p>}
    </div>
  );
}

function PlanCard({
  name,
  price,
  note,
  items,
  cta,
  featured = false,
}: {
  name: string;
  price: string;
  note: string;
  items: string[];
  cta: { href: string; label: string; external?: boolean };
  featured?: boolean;
}) {
  const box = featured
    ? "bg-brand-600 text-white border-transparent shadow-xl shadow-brand-600/20"
    : "border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.03]";
  const muted = featured ? "text-brand-100" : "text-slate-500 dark:text-slate-400";
  const tick = featured ? "bg-white/20 text-white" : "bg-mint-500/15 text-mint-700 dark:text-mint-400";
  const button = featured
    ? "bg-white text-brand-700 hover:bg-brand-50"
    : "border border-black/10 dark:border-white/15 hover:border-brand-500/50";

  return (
    <div className={`flex flex-col rounded-2xl border p-7 ${box}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest ${muted}`}>{name}</p>
      <p className="mt-1 text-3xl font-extrabold">{price}</p>
      <p className={`mt-2 text-sm ${muted}`}>{note}</p>
      <ul className="mt-6 flex-1 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm">
            <span aria-hidden className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${tick}`}>
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
      {cta.external ? (
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-7 block rounded-xl px-6 py-3 text-center font-bold transition-colors ${button}`}
        >
          {cta.label}
        </a>
      ) : (
        <Link href={cta.href} className={`mt-7 block rounded-xl px-6 py-3 text-center font-bold transition-colors ${button}`}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** One real question with its answer marked, linking to its public page. */
function SampleCard({ sample }: { sample: SampleQuestion }) {
  const q = sample.question;
  return (
    <figure className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden">
      <div className="flex flex-wrap gap-2 border-b border-black/5 dark:border-white/10 px-5 py-3 text-xs font-semibold">
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          {sample.subjectName}
        </span>
        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
          JAMB {q.year}
        </span>
        {q.topic && (
          <span className="rounded-md bg-brand-100 px-2 py-0.5 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300">
            {q.topic.name}
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="font-medium leading-relaxed">{q.plainText}</p>
        <ul className="mt-4 space-y-2">
          {q.options.map((o) => {
            const correct = o.label === q.answer;
            return (
              <li
                key={o.label}
                className={`flex gap-3 rounded-lg border border-dashed px-3 py-2 text-sm ${
                  correct
                    ? "border-mint-500 bg-mint-500/10 text-mint-800 dark:text-mint-300"
                    : "border-black/15 dark:border-white/15 text-slate-600 dark:text-slate-300"
                }`}
              >
                <span className="font-semibold">{o.label}.</span>
                <span>{o.plainText}</span>
                {correct && <span className="ml-auto font-semibold">Answer</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <figcaption className="border-t border-black/5 dark:border-white/10 px-5 py-3 text-sm">
        <Link href={questionPath(q.slug)} className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
          See this question and its explanation →
        </Link>
      </figcaption>
    </figure>
  );
}

/** Fallback hero art when no sample question could be loaded: a sketch of the CBT question grid. */
function CbtSketch() {
  return (
    <div aria-hidden className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-xl">
      <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-9 rounded-lg border border-dashed ${i === 2 ? "border-mint-500 bg-mint-500/10" : "border-black/15 dark:border-white/15"}`} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-10 gap-1.5">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} className={`aspect-square rounded ${i < 14 ? "bg-brand-500/70" : "bg-slate-200 dark:bg-slate-700"}`} />
        ))}
      </div>
    </div>
  );
}
