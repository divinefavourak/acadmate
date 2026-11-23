import MathText from "@/app/components/MathText";
import { truncate, type PublicQuestion } from "@/lib/pastQuestions";

/** Passage note, question text and figure, shared by the year list and the question page. */
export function QuestionStem({ question }: { question: PublicQuestion }) {
  return (
    <>
      {question.proseText && (
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
          From <cite className="not-italic font-medium">{question.proseText.title}</cite>
          {question.proseText.author ? ` by ${question.proseText.author}` : ""}
        </p>
      )}
      <MathText text={question.text} />
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted figures of unknown size
        <img
          src={question.imageUrl}
          alt={`Figure for: ${truncate(question.plainText, 100)}`}
          loading="lazy"
          className="mt-4 max-h-80 w-auto max-w-full rounded-xl bg-white object-contain border border-black/5 dark:border-white/10"
        />
      )}
    </>
  );
}

/** Options A–D. With `revealAnswer`, the correct one is marked. */
export function OptionList({
  question,
  revealAnswer = false,
}: {
  question: PublicQuestion;
  revealAnswer?: boolean;
}) {
  return (
    <ol className="space-y-2" aria-label="Options">
      {question.options.map((o) => {
        const correct = revealAnswer && o.label === question.answer;
        return (
          <li
            key={o.label}
            className={`flex gap-3 rounded-xl border px-4 py-3 ${
              correct
                ? "border-emerald-500/60 bg-emerald-500/10"
                : "border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]"
            }`}
          >
            <span
              className={`shrink-0 font-semibold ${correct ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}
            >
              {o.label}.
            </span>
            <span className="min-w-0 flex-1">
              <MathText text={o.text} />
            </span>
            {correct && (
              <span className="shrink-0 self-center text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Correct
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
