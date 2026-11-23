import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, jsonLdHtml } from "@/lib/seo";
import {
  HUB_PATH,
  getHub,
  subjectPath,
  yearPath,
  yearRange,
} from "@/lib/pastQuestions";
import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "./components/Breadcrumbs";
import { PracticeCta } from "./components/PracticeCta";

export const revalidate = 3600;

const CRUMBS: Crumb[] = [{ name: "Home", href: "/" }, { name: "JAMB past questions" }];

export async function generateMetadata(): Promise<Metadata> {
  const hub = await getHub();
  const allYears = hub.subjects.flatMap((s) => s.years);
  const metadata = buildMetadata({
    title: "JAMB Past Questions and Answers, Free with Explanations",
    description:
      `Free JAMB past questions with answers and worked explanations: ` +
      `${hub.total.toLocaleString("en-NG")} questions in ${hub.subjects.length} subjects` +
      `${allYears.length ? `, from ${yearRange(allYears)}` : ""}. No sign-up needed.`,
    path: HUB_PATH,
  });
  // A layout's title template only reaches child segments, so this page (in
  // the layout's own segment) would get the root "%s | Acadmate" on top of
  // buildMetadata's brand. An absolute title skips the template.
  return { ...metadata, title: { absolute: metadata.title as string } };
}

export default async function PastQuestionsHub() {
  const hub = await getHub();

  return (
    <div className="max-w-5xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(CRUMBS, HUB_PATH))} />
      <Breadcrumbs items={CRUMBS} />

      <header className="mb-10 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          JAMB past questions and answers
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
          {`${hub.total.toLocaleString("en-NG")} real JAMB questions from past papers, each with the ` +
            "correct answer and a worked explanation. Pick a subject and a year to start. " +
            "You don't need an account to read them."}
        </p>
      </header>

      {hub.subjects.length === 0 ? (
        <p className="text-slate-500">No past questions are published yet. Check back soon.</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {hub.subjects.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-5"
            >
              <h2 className="text-xl font-bold">
                <Link href={subjectPath(s.slug)} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  JAMB {s.name}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {s.total.toLocaleString("en-NG")} questions · {s.years.length}{" "}
                {s.years.length === 1 ? "paper" : "papers"} · {yearRange(s.years)}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label={`${s.name} papers by year`}>
                {s.years.map((y) => (
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
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12">
        <PracticeCta href="/exam/new" title="Ready to test yourself?" />
      </div>
    </div>
  );
}
