"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UserAvatar from "@/app/components/UserAvatar";
import { apiClient } from "@/lib/api/client";

interface MeWithAvatar {
  name: string | null;
  email: string;
  role: string;
  studentProfile: {
    avatarConfig: Record<string, unknown> | null;
    avatarUrl: string | null;
  } | null;
}

type Props = {
  /** Compact mode renders just the avatar (used in the mobile header). */
  compact?: boolean;
  className?: string;
};

export default function UserMenu({ compact = false, className = "" }: Props) {
  const [me, setMe] = useState<MeWithAvatar | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient<MeWithAvatar>("/api/users/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        /* keep fallback avatar */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const avatarConfig = me?.studentProfile?.avatarConfig ?? null;
  const avatarUrl = me?.studentProfile?.avatarUrl ?? null;

  if (compact) {
    return (
      <Link
        href="/dashboard/profile"
        aria-label="Profile"
        className={`shrink-0 rounded-full ring-2 ring-transparent hover:ring-indigo-500/40 transition ${className}`}
      >
        <UserAvatar avatarConfig={avatarConfig} avatarUrl={avatarUrl} name={me?.name} size={36} />
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/profile"
      className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${className}`}
    >
      <UserAvatar avatarConfig={avatarConfig} avatarUrl={avatarUrl} name={me?.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{me?.name ?? "Loading…"}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{me?.email ?? ""}</p>
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
