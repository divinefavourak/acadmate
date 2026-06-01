import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-slate-50 dark:bg-[#09090b] select-none">
      {children}
    </div>
  );
}
