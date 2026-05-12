"use client";

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api/client";

export default function UpgradePage() {
  const [plan, setPlan] = useState<"FREE" | "PREMIUM" | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<{ plan: "FREE" | "PREMIUM" }>("/api/users/me/plan")
      .then((data) => setPlan(data.plan))
      .catch(() => setPlan("FREE"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setRedeeming(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiClient<{ message: string }>("/api/users/me/redeem-token", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      setSuccess(data.message);
      setPlan("PREMIUM");
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to redeem code. Please try again.");
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Plan & Access</h1>
        <p className="text-slate-500 dark:text-slate-400">Manage your subscription access.</p>
      </div>

      {/* Current plan status */}
      <div className={`rounded-2xl border p-6 ${
        plan === "PREMIUM"
          ? "border-indigo-500/40 bg-indigo-500/5"
          : "border-slate-200 dark:border-slate-800 bg-white/3"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
            plan === "PREMIUM" ? "bg-indigo-500/20" : "bg-slate-500/10"
          }`}>
            {plan === "PREMIUM" ? "⭐" : "🆓"}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Current Plan</p>
            <p className={`text-2xl font-extrabold ${plan === "PREMIUM" ? "text-indigo-400" : "text-white"}`}>
              {plan === "PREMIUM" ? "Premium" : "Free"}
            </p>
          </div>
          {plan === "PREMIUM" && (
            <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Active
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Subject Practice", free: true, premium: true },
            { label: "Topic Drills", free: true, premium: true },
            { label: "Full UTME Mock Exam", free: false, premium: true },
            { label: "Post-UTME Past Papers", free: false, premium: true },
            { label: "Unlimited question count", free: false, premium: true },
            { label: "AI-powered explanations", free: true, premium: true },
          ].map((f) => {
            const has = plan === "PREMIUM" ? f.premium : f.free;
            return (
              <div key={f.label} className={`flex items-center gap-2.5 text-sm ${has ? "text-slate-200" : "text-slate-500"}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  has ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/50 text-slate-600"
                }`}>
                  {has ? "✓" : "×"}
                </span>
                {f.label}
                {!f.free && f.premium && plan !== "PREMIUM" && (
                  <span className="text-xs text-indigo-400 font-medium">Premium</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Redeem form */}
      {plan !== "PREMIUM" && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-lg mb-1">Redeem Access Code</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter the code you received after payment to unlock full Premium access.
            </p>
          </div>

          <form onSubmit={handleRedeem} className="space-y-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ACM-XXXX-XXXX"
              spellCheck={false}
              className="w-full bg-white/5 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={redeeming || !code.trim()}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {redeeming ? "Verifying…" : "Activate Premium Access"}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center">
            Need an access code? Contact us on{" "}
            <a href="https://wa.me/2349031843486" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              WhatsApp
            </a>{" "}
            to make payment and receive your code.
          </p>
        </div>
      )}

      {/* Success state */}
      {success && (
        <div className="px-5 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
          🎉 {success}
        </div>
      )}

      {plan === "PREMIUM" && (
        <div className="glass-panel rounded-2xl p-6 text-center space-y-2">
          <p className="text-slate-400 text-sm">You have full Premium access. Enjoy all exam modes!</p>
          <p className="text-xs text-slate-500">
            Questions? Reach us on{" "}
            <a href="https://wa.me/2349031843486" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              WhatsApp
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
