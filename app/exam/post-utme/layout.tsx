import Sidebar, { navItems } from "../../dashboard/components/Sidebar";
import DashboardHeader from "../../components/layout/DashboardHeader";

export default function PostUtmeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-50 dark:bg-[#09090b] md:flex-row">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full mix-blend-multiply filter blur-[150px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] bg-purple-500 rounded-full mix-blend-multiply filter blur-[150px] opacity-10 pointer-events-none" />
      <Sidebar />
      <DashboardHeader navItems={navItems} />
      <main className="flex-1 overflow-y-auto w-full relative z-10">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
