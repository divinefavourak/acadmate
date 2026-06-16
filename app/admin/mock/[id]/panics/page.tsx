"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

interface PanicReport {
  id: string;
  message: string | null;
  isResolved: boolean;
  resolvedNote: string | null;
  createdAt: string;
  participant: { name: string | null; phone: string };
  session: { attemptNumber: number };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PanicsPage() {
  const { id } = useParams<{ id: string }>();
  const [reports, setReports] = useState<PanicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    setLoading(true);
    apiClient<PanicReport[]>(`/api/admin/mock/${id}/panics`)
      .then(setReports)
      .catch(() => setError("Failed to load panic reports"))
      .finally(() => setLoading(false));
  }

  async function handleResolve(reportId: string) {
    setResolving(reportId);
    try {
      const updated = await apiClient<PanicReport>(`/api/admin/mock/${id}/panics/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ isResolved: true }),
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to resolve");
    } finally {
      setResolving(null);
    }
  }

  const open = reports.filter((r) => !r.isResolved);
  const resolved = reports.filter((r) => r.isResolved);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {open.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          {open.length} unresolved panic report{open.length > 1 ? "s" : ""} — respond promptly
        </div>
      )}

      {loading ? <Loader className="py-8" /> : reports.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center text-slate-400 text-sm">
          No panic reports yet. Participants can trigger this during the exam if they encounter issues.
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-red-600 dark:text-red-400 uppercase tracking-wide">Open ({open.length})</h3>
              {open.map((r) => (
                <div key={r.id} className="glass-panel rounded-2xl p-5 border border-red-200 dark:border-red-900 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{r.participant.name ?? "Unknown"}</p>
                      <p className="text-xs text-slate-400 font-mono">{r.participant.phone} · Attempt {r.session.attemptNumber}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{fmt(r.createdAt)}</span>
                  </div>
                  {r.message && (
                    <p className="text-sm bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 leading-relaxed">
                      "{r.message}"
                    </p>
                  )}
                  <button
                    onClick={() => handleResolve(r.id)}
                    disabled={resolving === r.id}
                    className="btn-primary disabled:opacity-60 self-start"
                  >
                    {resolving === r.id ? "Resolving…" : "Mark Resolved"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wide">Resolved ({resolved.length})</h3>
              {resolved.map((r) => (
                <div key={r.id} className="glass-panel rounded-2xl p-4 opacity-60 space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{r.participant.name ?? "Unknown"} · Attempt {r.session.attemptNumber}</p>
                      {r.message && <p className="text-xs text-slate-400 mt-0.5">"{r.message}"</p>}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{fmt(r.createdAt)}</span>
                  </div>
                  {r.resolvedNote && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Note: {r.resolvedNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
