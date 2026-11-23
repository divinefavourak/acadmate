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
      `${s.years.length === 1 ? "paper" : "papers"} (${yearRange(s.years)}), with answers and worked explanations. Free, no sign-up.`,
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
          answer and a worked explanation.
        </p>
      </header>

      <section aria-labelledby="years-heading">
        <h2 id="years-heading" className="text-xl font-bold mb-4">Papers by year</h2>
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {s.years.map((y) => (
            <li key={y.year}>
              <Link
                href={yearPath(s.slug, y.year)}
                className="block rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3 hover:border-indigo-500/50 transition-colors"
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

      {topics.length > 0 && (
        <section aria-labelledby="topics-heading" className="mt-12">
          <h2 id="topics-heading" className="text-xl font-bold">Topics</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">
            How often each topic comes up in these papers. Drill one in CBT mode.
          </p>
          <ul className="divide-y divide-black/5 dark:divide-white/5 rounded-2xl border border-black/5 dark:border-white/10">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="min-w-0">
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    · {t.count} {t.count === 1 ? "question" : "questions"}
                  </span>
                </span>
                <Link
                  href={practicePath(s.id, t.id)}
                  rel="nofollow"
                  className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Practise
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12">
        <PracticeCta href={practicePath(s.id)} title={`Practise JAMB ${s.name} in CBT mode`} />
      </div>
    </div>
  );
}
