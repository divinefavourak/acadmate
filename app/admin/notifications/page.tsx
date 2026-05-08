"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  questionId: string | null;
  triggeredBy: { name: string | null; email: string } | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function typeIcon(type: string) {
  if (type === "QUESTION_FLAGGED") return { icon: "🚩", label: "Flagged by student", color: "text-red-400 bg-red-900/20 border-red-800/40" };
  if (type === "NO_CORRECT_ANSWER") return { icon: "⚠️", label: "No correct answer", color: "text-amber-400 bg-amber-900/20 border-amber-800/40" };
  if (type === "TOO_MANY_OPTIONS") return { icon: "⚠️", label: "Too many options", color: "text-amber-400 bg-amber-900/20 border-amber-800/40" };
  return { icon: "ℹ️", label: type, color: "text-slate-400 bg-slate-800/40 border-slate-700" };
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [error, setError] = useState("");
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiClient<{ notifications: Notification[]; unreadCount: number }>("/api/admin/notifications");
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      console.error("Failed to load notifications", err);
      setError("Failed to load notifications. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  async function markAllRead() {
    try {
      await apiClient("/api/admin/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read", err);
      setError("Failed to mark notifications as read. Please try again.");
    }
  }

  function handleClick(n: Notification) {
    if (n.questionId) {
      router.push(`/admin/questions?flagged=true&highlight=${n.questionId}`);
    }
  }

  const shown = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="space-y-6">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Notifications</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Question issues flagged by students or detected automatically.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="btn-secondary text-sm px-4 py-2"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === t
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t}
            {t === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm py-16 text-center">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-2">
          <p className="text-2xl">🔔</p>
          <p className="font-semibold">{filter === "unread" ? "All caught up!" : "No notifications yet"}</p>
          <p className="text-sm text-slate-500">
            {filter === "unread" ? "No unread notifications." : "Notifications appear here when students flag questions or issues are detected."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((n) => {
            const { icon, label, color } = typeIcon(n.type);
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.005] ${
                  n.questionId ? "cursor-pointer" : "cursor-default"
                } ${
                  !n.read
                    ? "border-slate-700 bg-slate-900/60"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 mt-0.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
                    {icon} {label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? "text-white font-medium" : "text-slate-600 dark:text-slate-400"}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">{timeAgo(n.createdAt)}</span>
                      {n.triggeredBy && (
                        <span className="text-xs text-slate-500">
                          by {n.triggeredBy.name ?? n.triggeredBy.email}
                        </span>
                      )}
                      {n.questionId && (
                        <span className="text-xs text-indigo-500">View question →</span>
                      )}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-400 mt-1.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
