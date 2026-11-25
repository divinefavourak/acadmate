"use client";

interface QuestionGridProps {
  totalQuestions: number;
  currentQuestion: number;
  answeredQuestions: number[];
  markedQuestions?: number[];
  onSelect: (index: number) => void;
}

/**
 * The question palette. Every button keeps its number: a question marked for
 * review is shown in amber with a corner marker, so you can still see which
 * number it is (it used to be replaced by a flag emoji).
 */
export default function QuestionGrid({
  totalQuestions,
  currentQuestion,
  answeredQuestions,
  markedQuestions = [],
  onSelect,
}: QuestionGridProps) {
  const answeredSet = new Set(answeredQuestions);
  const markedSet = new Set(markedQuestions);

  return (
    <div className="grid grid-cols-5 gap-2 mt-4 max-h-[300px] overflow-y-auto p-1 pr-2 pb-2">
      {Array.from({ length: totalQuestions }).map((_, idx) => {
        const isCurrent = idx === currentQuestion;
        const isAnswered = answeredSet.has(idx);
        const isMarked = markedSet.has(idx);

        let tone: string;
        if (isCurrent) {
          tone =
            "bg-brand-600 text-white shadow-md shadow-brand-500/25 ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-navy-950";
        } else if (isMarked) {
          tone =
            "bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/60 hover:bg-amber-400/30";
        } else if (isAnswered) {
          tone =
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20";
        } else {
          tone =
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800";
        }

        const status = [isAnswered ? "answered" : "not answered", isMarked ? "marked for review" : null]
          .filter(Boolean)
          .join(", ");

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(idx)}
            aria-label={`Question ${idx + 1}, ${status}`}
            aria-current={isCurrent ? "step" : undefined}
            className={`relative w-10 h-10 rounded-lg text-sm font-medium tabular-nums transition-all flex items-center justify-center ${tone}`}
          >
            {idx + 1}
            {isMarked && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white dark:ring-navy-950"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
