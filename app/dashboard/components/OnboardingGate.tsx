"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { getToken } from "@/lib/api/auth";
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
    if (!getToken()) {
      router.replace("/login");
      setStatus("redirecting");
      return;
    }

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
