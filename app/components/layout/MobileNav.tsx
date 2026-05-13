"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/api/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  title?: string;
  showSignOut?: boolean;
}

export default function MobileNav({
  isOpen,
  onClose,
  navItems,
  title = "Acadmate",
  showSignOut = false,
}: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 w-[80%] max-w-sm bg-white dark:bg-[#09090b] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out translate-x-0 border-l border-slate-200 dark:border-slate-800">
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-900">
          <Link href="/" className="flex items-center gap-2 group" onClick={onClose}>
            <Image src="/images/logo.jpg" alt="Acadmate Logo" width={28} height={28} className="rounded-lg shadow-sm" />
            <span className="text-lg font-bold tracking-tight">{title}</span>
          </Link>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map(({ href, label, icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-semibold transition-all ${
                  active
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <span className={`${active ? "text-indigo-500" : "text-slate-400"}`}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {showSignOut && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-900">
            <button
              onClick={() => signOut().then(() => { router.push("/"); onClose(); })}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all border border-transparent hover:border-red-500/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
