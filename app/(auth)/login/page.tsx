"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiClient, ApiError } from "@/lib/api/client";
import { setToken, relayTokenToFrontend, RelayError } from "@/lib/api/auth";
import { scaleIn, stagger, fadeUp } from "@/lib/motion";
import { GoogleButton } from "../components/GoogleButton";
import Loader from "@/app/components/Loader";

function Divider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      <span className="text-xs text-slate-400">or</span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") ?? "/dashboard";
  // Allow only same-origin paths: must start with / and have no second / or \
  // (blocks //evil.com and /\evil.com browser-normalisation bypasses).
  const callbackUrl = /^\/(?:[^/\\]|$)/.test(rawCallback) ? rawCallback : "/dashboard";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiClient<{ accessToken: string; user: { role: string } }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ identifier, password }), skipAuth: true },
      );

      setToken(data.accessToken);
      await relayTokenToFrontend(data.accessToken);
      window.location.href = data.user.role === "ADMIN" ? "/admin" : callbackUrl;
    } catch (err) {
      setLoading(false);
      if (err instanceof RelayError) {
        setError("Sign-in failed due to a server configuration issue. Please try again later.");
      } else {
        setError(err instanceof ApiError ? err.message : "Invalid credentials.");
      }
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
        <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Enter your credentials to continue your prep.</p>
      </div>

      <GoogleButton />
      <Divider />

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium ml-1">Email or Phone Number</label>
          <input
            type="text"
            autoComplete="username"
            placeholder="jambite@example.com or 08012345678"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between ml-1">
            <label className="text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-xs text-brand-500 hover:text-brand-600 font-semibold">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full block text-center mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-brand-500 font-semibold hover:text-brand-600 transition-colors">
          Create one
        </Link>
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Loader className="h-96" />}>
      <LoginForm />
    </Suspense>
  );
}
