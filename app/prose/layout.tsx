import Sidebar from "../dashboard/components/Sidebar";

export default function ProseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#09090b]">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full mix-blend-multiply filter blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] bg-purple-500 rounded-full mix-blend-multiply filter blur-[150px] opacity-10 pointer-events-none" />
      <Sidebar />
      <main className="flex-1 overflow-y-auto w-full relative z-10">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
