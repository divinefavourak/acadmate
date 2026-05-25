"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import Loader from "@/app/components/Loader";

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, error } = useUser();

  useEffect(() => {
    if (error) {
      router.replace("/login");
      return;
    }
    if (!loading && user && user.role !== "ADMIN" && !user.onboardedAt) {
      router.replace("/onboarding");
    }
  }, [user, loading, error, router]);

  if (loading || (!user && !error)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  return <>{children}</>;
}
