import MathText from "@/app/components/MathText";
import { questionPath, truncate, type PublicQuestion } from "@/lib/pastQuestions";
import { ExplanationGate } from "./ExplanationGate";
import { QuestionCard } from "./QuestionCard";

const CHIP = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";

/** Subject · year · topic tags across the top of a card. */
export function QuestionChips({ subject, question }: { subject: string; question: PublicQuestion }) {
  return (
    <>
      <span className={`${CHIP} bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300`}>{subject}</span>
      <span className={`${CHIP} bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300`}>{question.year}</span>
      {question.topic && (
        <span className={`${CHIP} bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300`}>
          {question.topic.name}
        </span>
      )}
    </>
  );
}

/** Passage note, numbered question text and figure. */
export function QuestionStem({ question }: { question: PublicQuestion }) {
  return (
    <>
      {question.proseText && (
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
          From <cite className="not-italic font-medium">{question.proseText.title}</cite>
          {question.proseText.author ? ` by ${question.proseText.author}` : ""}
        </p>
      )}
      <div className="text-[15px] md:text-base leading-relaxed text-slate-800 dark:text-slate-100">
        <span className="font-semibold">{question.number}.</span> <MathText text={question.text} />
      </div>
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted figures of unknown size
        <img
          src={question.imageUrl}
          alt={`Figure for: ${truncate(question.plainText, 100)}`}
          loading="lazy"
          className="mt-4 max-h-80 w-auto max-w-full rounded-lg bg-white object-contain border border-black/5 dark:border-white/10"
        />
      )}
    </>
  );
}

/** Options A–D. The correct one turns green once the card's solution is open. */
export function OptionList({ question }: { question: PublicQuestion }) {
  return (
    <ol className="mt-4 space-y-2" aria-label="Options">
      {question.options.map((o) => {
        const correct = o.label === question.answer;
        return (
          <li
            key={o.label}
            className={`flex items-baseline gap-3 rounded-md border border-dashed border-black/15 dark:border-white/15 px-3 py-2.5 text-sm transition-colors ${
              correct
                ? "group-data-[revealed=true]:border-solid group-data-[revealed=true]:border-emerald-500/70 group-data-[revealed=true]:bg-emerald-50 dark:group-data-[revealed=true]:bg-emerald-500/10"
                : ""
            }`}
          >
            <span
              className={`w-4 shrink-0 font-semibold text-slate-500 dark:text-slate-400 ${
                correct ? "group-data-[revealed=true]:text-emerald-700 dark:group-data-[revealed=true]:text-emerald-400" : ""
              }`}
            >
              {o.label}.
            </span>
            <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
              <MathText text={o.text} />
            </span>
            {correct && (
              <span className="hidden shrink-0 self-center text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 group-data-[revealed=true]:inline">
                Correct
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The card's solution panel: the answer (public, in the HTML) and the worked
 * explanation (signed-in only, fetched when the panel opens).
 */
export function Solution({ question, anchor }: { question: PublicQuestion; anchor?: string }) {
  const correct = question.options.find((o) => o.label === question.answer);
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 p-4 text-sm">
      <p className="font-semibold text-emerald-800 dark:text-emerald-300">
        Answer: {question.answer}
      </p>
      {correct && (
        <div className="mt-0.5 text-slate-800 dark:text-slate-200">
          <MathText text={correct.text} />
        </div>
      )}
      <ExplanationGate slug={question.slug} anchor={anchor} />
    </div>
  );
}

/** A complete question card for year pages (solution closed) and question pages (solution open). */
export function PastQuestionCard({
  question,
  subject,
  onOwnPage = false,
}: {
  question: PublicQuestion;
  subject: string;
  onOwnPage?: boolean;
}) {
  return (
    <QuestionCard
      id={onOwnPage ? undefined : `q${question.number}`}
      chips={<QuestionChips subject={subject} question={question} />}
      body={
        <>
          <QuestionStem question={question} />
          <OptionList question={question} />
        </>
      }
      solution={<Solution question={question} anchor={onOwnPage ? undefined : `q${question.number}`} />}
      href={onOwnPage ? undefined : questionPath(question.slug)}
      sharePath={questionPath(question.slug)}
      shareTitle={`JAMB ${subject} ${question.year}: ${truncate(question.plainText, 80)}`}
      defaultOpen={onOwnPage}
    />
  );
}
