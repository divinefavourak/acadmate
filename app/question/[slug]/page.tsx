import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MathText from "@/app/components/MathText";
import { buildMetadata, jsonLdHtml, quizSchema } from "@/lib/seo";
import {
  EXAM_LABEL,
  HUB_PATH,
  getQuestion,
  practicePath,
  questionPath,
  subjectPath,
  truncate,
  yearPath,
} from "@/lib/pastQuestions";
import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "@/app/past-questions/components/Breadcrumbs";
import { OptionList, QuestionStem } from "@/app/past-questions/components/QuestionBody";
import { PracticeCta } from "@/app/past-questions/components/PracticeCta";

export const revalidate = 3600;

// Rendered on first visit, then cached (ISR). An empty list is what enables that.
export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getQuestion(slug);
  if (!data) return { title: "Question not found" };
  const { question: q, subject: s } = data;
  const label = `${EXAM_LABEL} ${s.name} ${q.year}`;
  return buildMetadata({
    title: `${truncate(q.plainText, 70)} | ${label}`,
    description: truncate(
      `${label}, question ${q.number}: ${q.plainText} Answer: ${q.answer}.` +
        (q.explanationPlain ? ` ${q.explanationPlain}` : ""),
      158,
    ),
    path: questionPath(q.slug),
  });
}

export default async function QuestionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await getQuestion(slug);
  if (!data) notFound();
  const { question: q, subject: s, prev, next, related, yearPage } = data;
  const path = questionPath(q.slug);
  const paperLink = `${yearPath(s.slug, q.year, yearPage)}#q${q.number}`;
  const correct = q.options.find((o) => o.label === q.answer);

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "JAMB past questions", href: HUB_PATH },
    { name: s.name, href: subjectPath(s.slug) },
    { name: String(q.year), href: yearPath(s.slug, q.year) },
    { name: `Question ${q.number}` },
  ];

  const jsonLd = [
    quizSchema({
      path,
      name: `${EXAM_LABEL} ${s.name} ${q.year}, question ${q.number}`,
      subject: s.name,
      topic: q.topic?.name,
      text: q.plainText,
      options: q.options,
      answer: q.answer,
      explanation: q.explanationPlain,
    }),
    breadcrumbJsonLd(crumbs, path),
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(jsonLd)} />
      <Breadcrumbs items={crumbs} />

      <article>
        <header className="mb-5">
          <h1 className="text-sm font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-400">
            {EXAM_LABEL} {s.name} {q.year}, Question {q.number}
          </h1>
          {q.topic && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Topic: {q.topic.name}</p>
          )}
        </header>

        {/* A div, not a heading: the stem can hold a passage note, a figure and block math. */}
        <div className="mb-6 text-xl md:text-2xl font-semibold leading-relaxed">
          <QuestionStem question={q} />
        </div>

        <OptionList question={q} revealAnswer />

        <section aria-labelledby="answer-heading" className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 md:p-6">
          <h2 id="answer-heading" className="text-lg font-bold">
            Answer: {q.answer}
          </h2>
          {correct && (
            <div className="mt-1 font-medium">
              <MathText text={correct.text} />
            </div>
          )}
          {q.explanation && (
            <div className="mt-3 leading-relaxed text-slate-700 dark:text-slate-300">
              <h3 className="sr-only">Explanation</h3>
              <MathText text={q.explanation} />
            </div>
          )}
        </section>
      </article>

      <nav aria-label="Questions in this paper" className="mt-8 grid grid-cols-3 items-center gap-2 text-sm">
        <span>
          {prev && (
            <Link href={questionPath(prev)} rel="prev" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              ← Previous
            </Link>
          )}
        </span>
        <Link href={paperLink} className="text-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
          All {q.year} questions
        </Link>
        <span className="text-right">
          {next && (
            <Link href={questionPath(next)} rel="next" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Next →
            </Link>
          )}
        </span>
      </nav>

      <div className="mt-10">
        <PracticeCta
          href={practicePath(s.id, q.topic?.id)}
          title={q.topic ? `Practise ${q.topic.name} questions in CBT mode` : `Practise JAMB ${s.name} in CBT mode`}
        />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2 id="related-heading" className="text-lg font-bold mb-4">
            {q.topic ? `More ${q.topic.name} questions` : `More from the ${q.year} paper`}
          </h2>
          <ul className="space-y-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={questionPath(r.slug)}
                  className="block rounded-xl border border-black/5 dark:border-white/10 px-4 py-3 hover:border-indigo-500/50 transition-colors"
                >
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {EXAM_LABEL} {s.name} {r.year}
                  </span>
                  <span className="block mt-0.5">{r.snippet}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
