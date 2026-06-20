"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

interface Participant {
  id: string;
  phone: string;
  name: string | null;
  isRegistered: boolean;
  isApproved: boolean;
  createdAt: string;
  _count: { sessions: number };
}

export default function ParticipantsPage() {
  const { id } = useParams<{ id: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add phone form
  const [phones, setPhones] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    setLoading(true);
    apiClient<Participant[]>(`/api/admin/mock/${id}/participants`)
      .then(setParticipants)
      .catch(() => setError("Failed to load participants"))
      .finally(() => setLoading(false));
  }

  async function handleAddPhones(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    setAddResult(null);
    const phoneList = phones
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (phoneList.length === 0) {
      setError("Please enter at least one phone number.");
      setAdding(false);
      return;
    }
    try {
      const res = await apiClient<{ added: number; skipped: number }>(`/api/admin/mock/${id}/participants/bulk`, {
        method: "POST",
        body: JSON.stringify({ phones: phoneList }),
      });
      setAddResult(res);
      setPhones("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add phones");
    } finally {
      setAdding(false);
    }
  }

  async function removeParticipant(participantId: string, label: string) {
    if (!window.confirm(`Remove ${label}? This deletes their registration and all mock attempts. This cannot be undone.`)) return;
    try {
      await apiClient(`/api/admin/mock/${id}/participants/${participantId}`, { method: "DELETE" });
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove participant");
    }
  }

  async function toggleApproval(participantId: string, current: boolean) {
    try {
      const updated = await apiClient<Participant>(`/api/admin/mock/${id}/participants/${participantId}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ isApproved: !current }),
      });
      setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, isApproved: updated.isApproved } : p)));
    } catch {
      setError("Failed to update approval");
    }
  }

  const registered = participants.filter((p) => p.isRegistered);
  const pending = participants.filter((p) => !p.isRegistered);

  return (
    <div className="space-y-6">
      {/* Add phones */}
      <form onSubmit={handleAddPhones} className="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h3 className="font-semibold">Add Approved Phone Numbers</h3>
          <p className="text-xs text-slate-400 mt-0.5">Paste numbers separated by commas or newlines. Only pre-approved phones can register.</p>
        </div>
        <textarea
          required
          rows={4}
          value={phones}
          onChange={(e) => setPhones(e.target.value)}
          placeholder={"08012345678\n08087654321\n09011112222"}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none"
        />
        {addResult && (
          <p className="text-sm text-emerald-500">
            Added {addResult.added} number{addResult.added !== 1 ? "s" : ""}
            {addResult.skipped > 0 ? ` · ${addResult.skipped} already existed` : ""}.
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={adding} className="btn-primary disabled:opacity-60">
          {adding ? "Adding…" : "Add Numbers"}
        </button>
      </form>

      {loading ? <Loader className="py-8" /> : (
        <div className="space-y-6">
          {/* Registered participants */}
          <div>
            <h3 className="font-semibold mb-3">Registered ({registered.length})</h3>
            {registered.length === 0 ? (
              <div className="glass-panel rounded-2xl p-6 text-center text-slate-400 text-sm">No one has registered yet.</div>
            ) : (
              <div className="glass-panel rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-800">
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3 text-center">Attempts</th>
                      <th className="px-4 py-3 text-center">Approved</th>
                      <th className="px-4 py-3 text-center">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {registered.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium">{p.name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{p.phone}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                            {p._count.sessions}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleApproval(p.id, p.isApproved)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                              p.isApproved
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
                                : "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                            }`}
                          >
                            {p.isApproved ? "Approved" : "Revoked"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeParticipant(p.id, p.name ?? p.phone)}
                            className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unregistered (approved phones not yet signed up) */}
          {pending.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Awaiting Registration ({pending.length})</h3>
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pending.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                      <span className="font-mono text-sm text-slate-500">{p.phone}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">Not registered</span>
                        <button
                          onClick={() => removeParticipant(p.id, p.phone)}
                          className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
