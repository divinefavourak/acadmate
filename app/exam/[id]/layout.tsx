export default function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-[#09090b]">
      {children}
    </div>
  );
}
