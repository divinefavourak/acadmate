import { AppShell, APP_METADATA } from "@/app/components/AppShell";
import OnboardingGate from "./components/OnboardingGate";

export const metadata = APP_METADATA;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <OnboardingGate>{children}</OnboardingGate>
    </AppShell>
  );
}
