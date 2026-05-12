export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#09090b]">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full mix-blend-multiply filter blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] bg-purple-500 rounded-full mix-blend-multiply filter blur-[150px] opacity-10 pointer-events-none" />

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
