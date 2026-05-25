import Image from "next/image";

interface Props {
  mode: string;
  totalQuestions: number;
  durationMinutes: number;
  onStart: () => void;
}

const MODE_LABEL: Record<string, string> = {
  POST_UTME: "Post-UTME",
  MOCK: "UTME Mock Exam",
  PRACTICE: "Practice Session",
};

const RULES = [
  { icon: "🖥️", text: "This exam runs in fullscreen. Exiting fullscreen counts as a violation." },
  { icon: "🔄", text: "Switching tabs or apps is detected. Stay on this page for the entire session." },
  { icon: "⚠️", text: "You have 2 strikes. Exhausting them auto-submits your exam immediately." },
  { icon: "🚫", text: "Copying, cutting, and right-clicking are disabled during the exam." },
  { icon: "⏱️", text: "The timer starts the moment you click Begin. It does not pause." },
];

export default function ExamBriefing({ mode, totalQuestions, durationMinutes, onStart }: Props) {
  async function handleBegin() {
    // Request fullscreen inside the click handler — this is the user gesture window.
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // User declined or browser doesn't support — exam still proceeds.
    }
    onStart();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-lg space-y-8">

        {/* Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/images/logo.jpg" alt="Acadmate" width={48} height={48} className="rounded-xl shadow-md" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 mb-1">Acadmate CBT</p>
            <h1 className="text-2xl font-bold">{MODE_LABEL[mode] ?? mode}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              {totalQuestions} questions &nbsp;·&nbsp; {durationMinutes} minutes
            </p>
          </div>
        </div>

        {/* Rules card */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-6 space-y-4">
          <h2 className="font-semibold text-base">Before you begin</h2>
          <ul className="space-y-3">
            {RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-base leading-5 flex-shrink-0">{rule.icon}</span>
                <span>{rule.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Strike indicator */}
        <div className="flex items-center justify-center gap-3">
          {[1, 2].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 dark:border-amber-500 flex items-center justify-center text-sm font-bold text-amber-600 dark:text-amber-400">
                {n}
              </div>
              <span className="text-[10px] text-slate-400">Strike {n}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span className="text-[10px] text-slate-400">Auto-submit</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleBegin}
          className="w-full py-4 rounded-2xl font-bold text-base bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white transition-all shadow-lg shadow-indigo-500/20"
        >
          I understand — Begin Exam
        </button>

        <p className="text-center text-xs text-slate-400">
          By starting, you agree to complete this exam honestly without assistance.
        </p>
      </div>
    </div>
  );
}
