"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";

export default function MockRegisterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pin !== confirmPin) { setError("PINs do not match"); return; }
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be exactly 4 digits"); return; }
    setSubmitting(true);
    try {
      await apiClient(`/api/mock/${id}/register`, {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ phone: phone.trim(), name: name.trim(), pin }),
      });
      router.push(`/mock/${id}/login?registered=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Register for Mock Exam</h1>
          <p className="text-sm text-slate-400">Your phone number must be on the approved list to register.</p>
        </div>

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
            <label className="text-sm font-medium text-slate-300">Full Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Confirm PIN</label>
            <input
              required
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
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
            {submitting ? "Registering…" : "Register"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Already registered?{" "}
          <Link href={`/mock/${id}/login`} className="text-indigo-400 hover:text-indigo-300">Log in</Link>
        </p>
        <p className="text-center text-sm">
          <Link href={`/mock/${id}`} className="text-slate-500 hover:text-slate-300">← Back to exam info</Link>
        </p>
      </div>
    </div>
  );
}
