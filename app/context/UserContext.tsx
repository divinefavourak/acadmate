"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { ensureToken } from "@/lib/api/auth";

export interface UserMe {
  name: string | null;
  email: string;
  role: string;
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

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(false);
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

  useEffect(() => {
    if (!fetchedRef.current) fetch();
  }, [fetch]);

  return (
    <UserContext.Provider value={{ user, loading, error, refetch: fetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
