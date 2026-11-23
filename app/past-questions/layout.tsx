import type { Metadata } from "next";
import { PublicSiteShell } from "@/app/components/PublicSiteShell";

// Pages build complete titles with buildMetadata(), which already adds the
// brand, so the root layout's "%s | Acadmate" template must not add it again.
export const metadata: Metadata = { title: { template: "%s", default: "JAMB Past Questions | Acadmate" } };

export default function PastQuestionsLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteShell active="past-questions">{children}</PublicSiteShell>;
}
