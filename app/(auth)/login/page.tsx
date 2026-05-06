"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import { setToken } from "@/lib/api/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiClient<{ accessToken: string; user: { role: string } }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
          skipAuth: true,
        },
      );

      setToken(data.accessToken);
      const destination = data.user.role === "ADMIN" ? "/admin" : callbackUrl;
      router.push(destination);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(err instanceof ApiError ? err.message : "Invalid email or password.");
    }
  }

  return (
    <div className="glass-panel w-full max-w-md p-8 rounded-3xl relative overflow-hidden">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Enter your credentials to continue your prep.</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium ml-1">Email Address</label>
          <input
            type="email"
            placeholder="jambite@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between ml-1">
            <label className="text-sm font-medium">Password</label>
            <Link href="#" className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold">Forgot?</Link>
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
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="glass-panel w-full max-w-md p-8 rounded-3xl animate-pulse h-96" />}>
      <LoginForm />
    </Suspense>
  );
}
