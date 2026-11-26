"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { ensureToken } from "@/lib/api/auth";

export interface UserMe {
  name: string | null;
  email: string;
  role: string;
  /** FREE or PREMIUM (GET /api/users/me returns it). */
  plan?: "FREE" | "PREMIUM";
  onboardedAt: string | null;
  studentProfile: {
    avatarConfig: Record<string, unknown> | null;
    avatarUrl: string | null;
  } | null;
}

interface UserContextValue {
  user: UserMe | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  // Loads the user without touching loading/error: the first load starts from loading=true, and
  // refetch (called from event handlers) resets them first. So the effect never sets state itself.
  const load = useCallback(async () => {
    fetchedRef.current = true;

    // After a page refresh the in-memory token is gone. Restore it from the
    // frontend-domain HttpOnly cookie before making any authenticated API calls.
    await ensureToken();

    apiClient<UserMe>("/api/users/me")
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(false);
    void load();
  }, [load]);

  useEffect(() => {
    if (!fetchedRef.current) void load();
  }, [load]);

  return (
    <UserContext.Provider value={{ user, loading, error, refetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
