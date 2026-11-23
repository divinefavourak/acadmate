import Link from "next/link";

/** Hands a reader from a public page into the CBT. Logged-out visitors sign in first and come back to the same handoff. */
export function PracticeCta({
  href,
  title,
  body = "Timed, scored and in the same format as the JAMB CBT. Free to start.",
}: {
  href: string;
  title: string;
  body?: string;
}) {
  return (
    <aside className="rounded-2xl border border-indigo-500/20 bg-indigo-600/10 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
      </div>
      <Link
        href={href}
        rel="nofollow"
        className="shrink-0 text-center text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition-colors"
      >
        Practise in CBT mode
      </Link>
    </aside>
  );
}
