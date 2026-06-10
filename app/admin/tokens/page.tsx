"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

interface Token {
  id: string;
  code: string;
  note: string | null;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  usedBy: { id: string; name: string | null; email: string } | null;
  generatedBy: { id: string; name: string | null } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    apiClient<{ tokens: Token[]; total: number }>("/api/admin/tokens")
      .then((data) => { setTokens(data.tokens ?? []); setTotal(data.total ?? 0); })
      .catch(() => setError("Failed to load tokens."))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const data = await apiClient<{ token: Token }>("/api/admin/tokens", {
        method: "POST",
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      setTokens((prev) => [data.token as Token, ...prev]);
      setTotal((t) => t + 1);
      setNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate token.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await apiClient(`/api/admin/tokens/${id}`, { method: "DELETE" });
      setTokens((prev) => prev.filter((t) => t.id !== id));
      setTotal((c) => c - 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete token.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(id: string) {
    setBusyId(id);
    setError("");
    try {
      await apiClient(`/api/admin/tokens/${id}/revoke`, { method: "POST" });
      setTokens((prev) => prev.map((t) => t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke token.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(id: string) {
    setBusyId(id);
    setError("");
    try {
      await apiClient(`/api/admin/tokens/${id}/reactivate`, { method: "POST" });
      setTokens((prev) => prev.map((t) => t.id === id ? { ...t, revokedAt: null } : t));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reactivate token.");
    } finally {
      setBusyId(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopyFeedback(code);
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Access Tokens</h1>
        <p className="text-slate-500 dark:text-slate-400">Generate and manage premium access codes for students.</p>
      </div>

      {/* Generate panel */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Generate New Token</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Each token can only be redeemed once. Share the code with the student after payment.
        </p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional — e.g. John Doe, March 2026)"
            className="flex-1 min-w-64 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {generating ? "Generating…" : "Generate Token"}
          </button>
        </div>
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>

      {/* Token list */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">All Tokens</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">{total} total</span>
        </div>

        {loading ? (
          <Loader className="py-8" />
        ) : tokens.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">No tokens yet. Generate one above.</p>
        ) : (
          <div className="space-y-3">
            {tokens.map((t) => (
              <div
                key={t.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-colors ${
                  t.revokedAt
                    ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/10"
                    : t.usedAt
                    ? "border-slate-200 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-900/30"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600"
                }`}
              >
                {/* Code */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => copyCode(t.code)}
                    className="font-mono text-sm font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors shrink-0"
                    title="Click to copy"
                  >
                    {copyFeedback === t.code ? "Copied!" : t.code}
                  </button>
                  {t.note && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.note}</span>
                  )}
                </div>

                {/* Status + actions */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  {t.revokedAt ? (
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800">
                        Revoked
                      </span>
                      {t.usedBy && (
                        <p className="text-xs text-slate-500 mt-0.5">{t.usedBy.email}</p>
                      )}
                    </div>
                  ) : t.usedAt ? (
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800">
                        Redeemed
                      </span>
                      {t.usedBy && (
                        <p className="text-xs text-slate-500 mt-0.5">{t.usedBy.email}</p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800">
                      Unused
                    </span>
                  )}

                  <span className="text-xs text-slate-500">{formatDate(t.createdAt)}</span>

                  {t.revokedAt ? (
                    <button
                      onClick={() => handleReactivate(t.id)}
                      disabled={busyId === t.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-600 border border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition-colors"
                      title="Reactivate — restores Premium access"
                    >
                      {busyId === t.id ? "…" : "Reactivate"}
                    </button>
                  ) : t.usedAt ? (
                    <button
                      onClick={() => handleRevoke(t.id)}
                      disabled={busyId === t.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 border border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
                      title="Revoke — removes Premium access immediately"
                    >
                      {busyId === t.id ? "…" : "Revoke"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={busyId === t.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                      title="Delete token"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
