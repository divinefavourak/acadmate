"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";

export default function MockLoginPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(`mock_token_${id}`);
    if (token) router.replace(`/mock/${id}/exam`);
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await apiClient<{ accessToken: string; participant: { name: string | null } }>(`/api/mock/${id}/login`, {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ phone: phone.trim(), pin }),
      });
      localStorage.setItem(`mock_token_${id}`, res.accessToken);
      router.push(`/mock/${id}/exam`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Check your phone and PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Log In to Exam</h1>
          <p className="text-sm text-slate-400">Use the phone number and PIN you registered with.</p>
        </div>

        {justRegistered && (
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl px-4 py-3 text-sm text-emerald-300 text-center">
            Registration successful! Now log in to enter the exam.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 rounded-2xl p-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Phone Number</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08012345678"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">4-Digit PIN</label>
            <input
              required
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition-colors"
          >
            {submitting ? "Logging in…" : "Enter Exam"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          No account yet?{" "}
          <Link href={`/mock/${id}/register`} className="text-indigo-400 hover:text-indigo-300">Register</Link>
        </p>
        <p className="text-center text-sm">
          <Link href={`/mock/${id}`} className="text-slate-500 hover:text-slate-300">← Back to exam info</Link>
        </p>
      </div>
    </div>
  );
}
