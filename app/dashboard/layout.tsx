import Sidebar, { navItems } from "./components/Sidebar";
import DashboardHeader from "../components/layout/DashboardHeader";
import OnboardingGate from "./components/OnboardingGate";
import { UserProvider } from "../context/UserContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 dark:bg-[#09090b] md:flex-row relative">
        {/* Background Orbs — kept subtle and hidden on mobile to avoid wash on light mode */}
        <div className="hidden md:block absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-500 rounded-full dark:mix-blend-multiply filter blur-[150px] dark:opacity-10 pointer-events-none" />
        <div className="hidden md:block absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] bg-purple-500/10 dark:bg-purple-500 rounded-full dark:mix-blend-multiply filter blur-[150px] dark:opacity-10 pointer-events-none" />

        <Sidebar />
        <DashboardHeader navItems={navItems} />

        <main className="flex-1 overflow-y-auto w-full relative z-10 min-w-0">
          <div className="px-4 py-5 sm:px-6 md:p-8 max-w-7xl mx-auto">
            <OnboardingGate>{children}</OnboardingGate>
          </div>
        </main>
      </div>
    </UserProvider>
  );
}
