"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const role = searchParams.get("role");

    // The backend already set the HttpOnly cookie before this redirect.
    // No token is passed in the URL — auth is handled entirely via cookie.
    if (role === "ADMIN") {
      router.replace("/admin");
      return;
    }

    // Decide between dashboard (returning user) and onboarding (first OAuth sign-in).
    // The apiClient sends credentials: 'include', so the HttpOnly cookie authenticates this call.
    apiClient<{ onboardedAt: string | null }>("/api/users/me")
      .then((me) => {
        router.replace(me.onboardedAt ? "/dashboard" : "/onboarding");
      })
      .catch(() => router.replace("/login?error=oauth_failed"));
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
