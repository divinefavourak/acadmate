"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { setToken, relayTokenToFrontend } from "@/lib/api/auth";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const role = searchParams.get("role");

    // The backend set its HttpOnly cookie (on the Render domain) before this redirect.
    // We call /api/auth/token (uses that cookie via credentials: 'include') to get a
    // fresh JWT, then mirror it to the Vercel domain so Next.js middleware can see it.
    apiClient<{ accessToken: string }>("/api/auth/token")
      .then(async ({ accessToken }) => {
        setToken(accessToken);
        await relayTokenToFrontend(accessToken);

        if (role === "ADMIN") {
          router.replace("/admin");
          return;
        }

        const me = await apiClient<{ onboardedAt: string | null }>("/api/users/me");
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
