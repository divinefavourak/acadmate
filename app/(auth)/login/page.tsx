"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiClient, ApiError } from "@/lib/api/client";
import { setToken, relayTokenToFrontend, RelayError } from "@/lib/api/auth";
import { scaleIn, stagger, fadeUp } from "@/lib/motion";
import Loader from "@/app/components/Loader";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function GoogleButton() {
  return (
    <a
      href={`${API_URL}/api/auth/google`}
      className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-colors font-medium text-sm"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </a>
  );
}

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
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between ml-1">
            <label className="text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
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
        <Link href="/register" className="text-indigo-500 font-semibold hover:text-indigo-600 transition-colors">
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
