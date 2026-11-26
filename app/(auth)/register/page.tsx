"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiClient, ApiError } from "@/lib/api/client";
import { setToken } from "@/lib/api/auth";
import { scaleIn } from "@/lib/motion";
import { GoogleButton } from "../components/GoogleButton";
import { storeReferral } from "@/lib/referral";

const noSubscribe = () => () => {};

/** The ?ref= invite code, remembered for onboarding. Null on the server. */
function useInviteCode() {
  return useSyncExternalStore(
    noSubscribe,
    () => storeReferral(new URLSearchParams(window.location.search).get("ref")),
    () => null,
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const invited = useInviteCode();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiClient("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, phone: phone.trim() || undefined, password }),
        skipAuth: true,
      });

      const data = await apiClient<{ accessToken: string }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ identifier: email, password }), skipAuth: true },
      );

      setToken(data.accessToken);
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    }
  }

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className="glass-panel w-full max-w-md p-8 rounded-3xl relative overflow-hidden"
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Create an Account</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Start your premium UTME practice today.</p>
      </div>

      {invited && (
        <p role="status" className="mb-5 rounded-xl border border-mint-500/30 bg-mint-500/10 px-4 py-3 text-center text-sm text-mint-800 dark:text-mint-200">
          A friend invited you. Sign up and finish setting up your account, and they get bonus questions.
        </p>
      )}

      <GoogleButton />

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs text-slate-400">or</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium ml-1">Full Name</label>
          <input
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium ml-1">Email Address</label>
          <input
            type="email"
            placeholder="jambite@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium ml-1">
            Phone Number <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="08012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          />
          <p className="text-xs text-slate-400 ml-1">You can use this to sign in instead of your email.</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium ml-1">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full block text-center mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-500 font-semibold hover:text-brand-600 transition-colors">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
