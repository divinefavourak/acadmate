import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { buildMetadata, jsonLdHtml } from "@/lib/seo";
import {
  HUB_PATH,
  getYear,
  practicePath,
  subjectPath,
  truncate,
  yearPath,
  type YearData,
} from "@/lib/pastQuestions";
import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "../../../../components/Breadcrumbs";
import { PastQuestionCard } from "../../../../components/QuestionBody";
import { PracticeCta } from "../../../../components/PracticeCta";

export const revalidate = 2592000; // 30 days, matches PQ_REVALIDATE

// Rendered on first visit, then cached (ISR). An empty list is what enables that.
export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ subject: string; year: string; page?: string[] }>;

/**
 * Page 1 lives at /…/1990 and later pages at /…/1990/2, so every page is a
 * static path. Returns null for anything that isn't a valid page number.
 */
function parseRoute(year: string, page?: string[]): { year: number; page: number } | null {
  if (!/^\d{4}$/.test(year)) return null;
  if (!page || page.length === 0) return { year: Number(year), page: 1 };
  if (page.length !== 1 || !/^[1-9]\d{0,2}$/.test(page[0])) return null;
  return { year: Number(year), page: Number(page[0]) };
}

async function load(params: Params): Promise<YearData | null> {
  const { subject, year, page } = await params;  const route = parseRoute(year, page);
  if (!route) return null;
  // /1990/1 duplicates /1990.
  if (page?.[0] === "1") permanentRedirect(yearPath(subject, route.year));
  return getYear(subject, route.year, route.page);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Page not found" };
  const { subject: s, year, page, totalPages, total } = data;
  const pageNote = totalPages > 1 ? ` (Page ${page} of ${totalPages})` : "";
  const first = data.questions[0];
  return buildMetadata({
    title: `JAMB ${s.name} ${year} Past Questions and Answers${pageNote}`,
    description:
      `All ${total} questions from the JAMB ${year} ${s.name} paper, with answers` +
      `${page > 1 ? `, page ${page}` : ""}. ` +
      (first ? `Question ${first.number}: ${truncate(first.plainText, 70)}` : ""),
    path: yearPath(s.slug, year, page),
  });
}

export default async function YearPage({ params }: { params: Params }) {
  const data = await load(params);
  if (!data) notFound();
  const { subject: s, year, page, totalPages, total, questions } = data;
  const path = yearPath(s.slug, year, page);

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "JAMB past questions", href: HUB_PATH },
    { name: s.name, href: subjectPath(s.slug) },
    { name: String(year), ...(page > 1 && { href: yearPath(s.slug, year) }) },
    ...(page > 1 ? [{ name: `Page ${page}` }] : []),
  ];
  const otherYears = s.years.filter((y) => y.year !== year);

  return (
    <div className="max-w-3xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(crumbs, path))} />
      <Breadcrumbs items={crumbs} />

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          JAMB {s.name} {year} past questions
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
          {total} {total === 1 ? "question" : "questions"} from the {year} paper
          {totalPages > 1 && <>, showing {questions[0]?.number}–{questions[questions.length - 1]?.number}</>}.
          Try each one, then open the solution to check your answer. Sign in to see the worked explanations.
        </p>
      </header>

      <ol className="space-y-5">
        {questions.map((q) => (
          <li key={q.slug}>
            <PastQuestionCard question={q} subject={s.name} />
          </li>
        ))}
      </ol>

      {totalPages > 1 && (
        <nav aria-label="Pages" className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {page > 1 && (
            <Link href={yearPath(s.slug, year, page - 1)} rel="prev" className="px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5">
              ← Previous
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={yearPath(s.slug, year, n)}
              aria-current={n === page ? "page" : undefined}
              className={`min-w-10 text-center px-3 py-2 rounded-lg text-sm ${
                n === page
                  ? "bg-indigo-600 text-white font-semibold"
                  : "border border-black/10 dark:border-white/10 hover:border-indigo-500/50"
              }`}
            >
              {n}
            </Link>
          ))}
          {page < totalPages && (
            <Link href={yearPath(s.slug, year, page + 1)} rel="next" className="px-3 py-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5">
              Next →
            </Link>
          )}
        </nav>
      )}

      <div className="mt-12">
        <PracticeCta href={practicePath(s.id)} title={`Practise JAMB ${s.name} under exam conditions`} />
      </div>

      {otherYears.length > 0 && (
        <section aria-labelledby="other-years" className="mt-12">
          <h2 id="other-years" className="text-lg font-bold mb-3">Other JAMB {s.name} papers</h2>
          <ul className="flex flex-wrap gap-2">
            {otherYears.map((y) => (
              <li key={y.year}>
                <Link
                  href={yearPath(s.slug, y.year)}
                  className="inline-block rounded-lg border border-black/10 dark:border-white/10 px-2.5 py-1 text-sm hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {y.year}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
