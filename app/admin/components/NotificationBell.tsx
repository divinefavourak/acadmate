"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiClient } from "@/lib/api/client";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  const fetchCount = useCallback(async () => {
    try {
      const data = await apiClient<{ unreadCount: number }>("/api/admin/notifications");
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* silent */ }
  }, []);

  // Refresh count on mount + every 30s + when navigating away from notifications page
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount, pathname]);

  const active = pathname === "/admin/notifications";

  return (
    <Link
      href="/admin/notifications"
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
        active
          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </svg>
      Notifications
      {unreadCount > 0 && (
        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none min-w-[18px] text-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
