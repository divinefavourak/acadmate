"use client";

interface QuestionGridProps {
  totalQuestions: number;
  currentQuestion: number;
  answeredQuestions: number[];
  markedQuestions?: number[];
  onSelect: (index: number) => void;
}

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
    <div className="grid grid-cols-5 gap-2 mt-4 max-h-[300px] overflow-y-auto pr-2 pb-2">
      {Array.from({ length: totalQuestions }).map((_, idx) => {
        const isCurrent = idx === currentQuestion;
        const isAnswered = answeredSet.has(idx);
        const isMarked = markedSet.has(idx);

        let buttonClass =
          "w-10 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center ";

        if (isCurrent) {
          buttonClass +=
            "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-black";
        } else if (isMarked) {
          buttonClass +=
            "bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/50 hover:bg-amber-400/30";
        } else if (isAnswered) {
          buttonClass +=
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20";
        } else {
          buttonClass +=
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800";
        }

        return (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            title={isMarked ? "Flagged for review" : undefined}
            className={buttonClass}
          >
            {isMarked ? "🚩" : idx + 1}
          </button>
        );
      })}
    </div>
  );
}
