"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

type CheckStatus = "checking" | "ok" | "redirecting";

interface MeMinimal {
  onboardedAt: string | null;
  role: string;
}

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<CheckStatus>("checking");

  useEffect(() => {
    // Auth is guaranteed by the middleware (frontend cookie). Do not check the
    // in-memory token here — it is cleared on page refresh but the cookie persists,
    // and checking it would create a redirect loop with the middleware.
    let cancelled = false;
    apiClient<MeMinimal>("/api/users/me")
      .then((me) => {
        if (cancelled) return;
        // Admins skip the student onboarding wizard.
        if (me.role !== "ADMIN" && !me.onboardedAt) {
          router.replace("/onboarding");
          setStatus("redirecting");
          return;
        }
        setStatus("ok");
      })
      .catch(() => {
        if (cancelled) return;
        router.replace("/login");
        setStatus("redirecting");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status !== "ok") {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  return <>{children}</>;
}
