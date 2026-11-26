"use client";

import Link from "next/link";
import UserAvatar from "@/app/components/UserAvatar";
import { useUser } from "@/app/context/UserContext";
import { PREMIUM_RING, PremiumBadge } from "@/app/components/PremiumBadge";

type Props = {
  /** Compact mode renders just the avatar (used in the mobile header). */
  compact?: boolean;
  className?: string;
};

export default function UserMenu({ compact = false, className = "" }: Props) {
  const { user } = useUser();

  const avatarConfig = user?.studentProfile?.avatarConfig ?? null;
  const avatarUrl = user?.studentProfile?.avatarUrl ?? null;
  const premium = user?.plan === "PREMIUM";
  // Premium students get a gold ring round their avatar.
  const ring = (node: React.ReactNode) => (premium ? <span className={`${PREMIUM_RING} inline-flex`}>{node}</span> : node);

  if (compact) {
    return (
      <Link
        href="/dashboard/profile"
        aria-label={premium ? "Profile (Premium)" : "Profile"}
        className={`shrink-0 rounded-full ring-2 ring-transparent hover:ring-brand-500/40 transition ${className}`}
      >
        {ring(<UserAvatar avatarConfig={avatarConfig} avatarUrl={avatarUrl} name={user?.name} size={36} />)}
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/profile"
      className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${className}`}
    >
      {ring(<UserAvatar avatarConfig={avatarConfig} avatarUrl={avatarUrl} name={user?.name} size={40} />)}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{user?.name ?? "Loading…"}</p>
        {premium ? (
          <PremiumBadge className="mt-0.5" />
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email ?? ""}</p>
        )}
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-400 shrink-0"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}
