"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { setToken, relayTokenToFrontend, RelayError } from "@/lib/api/auth";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const role = searchParams.get("role");
    const fragment = window.location.hash.slice(1);
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("token");

    if (!accessToken) {
      router.replace("/login?error=oauth_failed");
      return;
    }

    // Clear the token from the URL immediately so it doesn't linger in history.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    (async () => {
      try {
        setToken(accessToken);
        await relayTokenToFrontend(accessToken);

        if (role === "ADMIN") {
          window.location.href = "/admin";
          return;
        }

        const me = await apiClient<{ onboardedAt: string | null }>("/api/users/me");
        window.location.href = me.onboardedAt ? "/dashboard" : "/onboarding";
      } catch (err) {
        const param = err instanceof RelayError ? "relay_failed" : "oauth_failed";
        router.replace(`/login?error=${param}`);
      }
    })();
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
