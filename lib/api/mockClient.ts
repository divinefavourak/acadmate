import { apiClient } from "@/lib/api/client";

/**
 * Authenticated fetch for the mock-exam participant flow. Participants hold a
 * separate token in localStorage (keyed by exam id), not the platform auth
 * cookie, so we attach it manually and skip the global auth handling.
 */
export function mockFetch<T>(path: string, examId: string, init?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem(`mock_token_${examId}`) : null;
  return apiClient<T>(path, {
    ...(init ?? {}),
    skipAuth: true,
    on401: "throw",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
