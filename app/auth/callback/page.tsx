"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/api/auth";
import { apiClient } from "@/lib/api/client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const role = searchParams.get("role");

    if (!token) {
      router.replace("/login?error=oauth_failed");
      return;
    }

    setToken(token);

    if (role === "ADMIN") {
      router.replace("/admin");
      return;
    }

    // Decide between dashboard (returning user) and onboarding (first OAuth sign-in)
    apiClient<{ onboardedAt: string | null }>("/api/users/me")
      .then((me) => {
        router.replace(me.onboardedAt ? "/dashboard" : "/onboarding");
      })
      .catch(() => router.replace("/dashboard"));
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
