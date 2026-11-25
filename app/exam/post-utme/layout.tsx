import { AppShell, APP_METADATA } from "@/app/components/AppShell";

export const metadata = APP_METADATA;

export default function PostUtmeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
