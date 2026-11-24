import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata, jsonLdHtml } from "@/lib/seo";
import {
  HUB_PATH,
  getSubject,
  practicePath,
  subjectPath,
  yearPath,
  yearRange,
  type SubjectData,
} from "@/lib/pastQuestions";
import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "../../components/Breadcrumbs";
import { PracticeCta } from "../../components/PracticeCta";

export const revalidate = 3600;

// Rendered on first visit, then cached (ISR). An empty list is what enables that.
export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ subject: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject: slug } = await params;
  const data = await getSubject(slug);
  if (!data) return { title: "Subject not found" };
  const s = data.subject;
  return buildMetadata({
    title: `JAMB ${s.name} Past Questions and Answers (${yearRange(s.years)})`,
    description:
      `${s.total.toLocaleString("en-NG")} JAMB ${s.name} past questions from ${s.years.length} ` +
      `${s.years.length === 1 ? "paper" : "papers"} (${yearRange(s.years)}), with answers. Free to read; sign in for worked explanations.`,
    path: subjectPath(s.slug),
  });
}

export default async function SubjectPage({ params }: { params: Params }) {
  const { subject: slug } = await params;
  const data = await getSubject(slug);
  if (!data) notFound();
  const { subject: s, topics } = data;

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "JAMB past questions", href: HUB_PATH },
    { name: s.name },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(crumbs, subjectPath(s.slug)))}
      />
      <Breadcrumbs items={crumbs} />

      <header className="mb-10 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          JAMB {s.name} past questions
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
          {s.total.toLocaleString("en-NG")} questions from {s.years.length} JAMB {s.name}{" "}
          {s.years.length === 1 ? "paper" : "papers"} ({yearRange(s.years)}), each with the correct
          answer. Sign in free to see the worked explanations.
        </p>
      </header>

      <section aria-labelledby="years-heading">
        <h2 id="years-heading" className="text-xl font-bold mb-4">Papers by year</h2>
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {s.years.map((y) => (
            <li key={y.year}>
              <Link
                href={yearPath(s.slug, y.year)}
                className="block rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3 hover:border-brand-500/50 transition-colors"
              >
                <span className="block font-semibold">JAMB {s.name} {y.year}</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">
                  {y.count} {y.count === 1 ? "question" : "questions"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {topics.length > 0 && <TopicRanking subject={s} topics={topics} />}

      <div className="mt-12">
        <PracticeCta href={practicePath(s.id)} title={`Practise JAMB ${s.name} in CBT mode`} />
      </div>
    </div>
  );
}

/** Topics ranked by how many questions they have in these papers, each with a Topic Drill link. */
function TopicRanking({ subject: s, topics }: SubjectData) {
  const max = Math.max(...topics.map((t) => t.count));
  return (
    <section aria-labelledby="topics-heading" className="mt-12 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900">
      <div className="bg-brand-700 px-5 py-4 text-white">
        <h2 id="topics-heading" className="text-lg font-bold">Most examined topics</h2>
        <p className="text-sm text-brand-100">In JAMB {s.name} past questions. Tap one to drill it in CBT mode.</p>
      </div>
      <ol className="grid sm:grid-cols-2">
        {topics.map((t, i) => (
          <li key={t.id} className="border-b border-black/5 dark:border-white/5 sm:odd:border-r">
            <Link
              href={practicePath(s.id, t.id)}
              rel="nofollow"
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-brand-50/60 dark:hover:bg-brand-500/10 transition-colors"
            >
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{t.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {t.count} {t.count === 1 ? "question" : "questions"}
                  </span>
                </span>
                <span className="mt-1.5 block h-1.5 rounded-full bg-brand-100 dark:bg-brand-500/15" aria-hidden>
                  <span className="block h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${Math.max(4, (t.count / max) * 100)}%` }} />
                </span>
              </span>
              <span className="shrink-0 text-slate-400" aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
