import type { Metadata } from "next";
import Sidebar, { navItems } from "@/app/dashboard/components/Sidebar";
import DashboardHeader from "@/app/components/layout/DashboardHeader";
import { UserProvider } from "@/app/context/UserContext";

/** Signed-in pages are private, so keep them out of search results. */
export const APP_METADATA: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Frame for every signed-in page: sidebar on desktop, top bar and slide-over
 * menu on phones, scrolling main column. Used by the dashboard, study,
 * analytics, results, prose, my-flags and exam-picker layouts.
 * Not used by the CBT itself (app/exam/[id]), which is full-screen, or by
 * onboarding, which hides navigation until the profile is complete.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-50 dark:bg-navy-950 md:flex-row">
        {/* Soft brand glow, desktop only so it doesn't wash out small screens. */}
        <div aria-hidden className="pointer-events-none absolute -top-[10%] -left-[10%] hidden h-1/2 w-1/2 rounded-full bg-brand-500/10 blur-[150px] md:block" />
        <div aria-hidden className="pointer-events-none absolute -bottom-[10%] -right-[10%] hidden h-1/2 w-2/5 rounded-full bg-mint-500/10 blur-[150px] md:block" />

        <Sidebar />
        <DashboardHeader navItems={navItems} />

        <main className="relative z-10 w-full min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:p-8">{children}</div>
        </main>
      </div>
    </UserProvider>
  );
}
