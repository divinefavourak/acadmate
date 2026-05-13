"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import MobileNav from "./MobileNav";
import UserMenu from "@/app/dashboard/components/UserMenu";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface DashboardHeaderProps {
  navItems: NavItem[];
  title?: string;
  showSignOut?: boolean;
}

export default function DashboardHeader({
  navItems,
  title = "Acadmate",
  showSignOut = true,
}: DashboardHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-[80] flex h-16 w-full items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-black/80 md:hidden">
        <Link href="/" className="flex items-center gap-2 group min-w-0">
          <Image src="/images/logo.jpg" alt="Acadmate Logo" width={28} height={28} className="rounded-lg shadow-sm shrink-0" />
          <span className="text-lg font-bold tracking-tight truncate">{title}</span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <UserMenu compact />
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
            aria-label="Open menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      <MobileNav
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        navItems={navItems}
        title={title}
        showSignOut={showSignOut}
      />
    </>
  );
}
