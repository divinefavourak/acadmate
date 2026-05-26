"use client";

import { apiClient } from "@/lib/api/client";
import { useQuery } from "./useQuery";

export interface AnalyticsData {
  totalTests: number;
  averageScore: number;
  bestScore: number;
  subjectPerformance: { subjectId: string; name: string; percentage: number }[];
}

export interface ResultEntry {
  id: string;
  score: number;
  correct: number;
  totalQuestions: number;
  createdAt: string;
  examSession: { id: string; mode: string; status: string };
}

export interface DashboardData {
  analytics: AnalyticsData | null;
  results: ResultEntry[];
  analyticsError: unknown;
  resultsError: unknown;
}

// Batches both dashboard requests into a single logical fetch.
// The server already has a 60 s analytics cache, so retries are cheap.
async function fetchDashboard(): Promise<DashboardData> {
  const [analyticsResult, resultsResult] = await Promise.allSettled([
    apiClient<AnalyticsData>("/api/analytics"),
    apiClient<{ results: ResultEntry[] }>("/api/results?limit=5"),
  ]);

  return {
    analytics: analyticsResult.status === "fulfilled" ? analyticsResult.value : null,
    results: resultsResult.status === "fulfilled" ? (resultsResult.value?.results ?? []) : [],
    analyticsError: analyticsResult.status === "rejected" ? analyticsResult.reason : null,
    resultsError: resultsResult.status === "rejected" ? resultsResult.reason : null,
  };
}

/** Returns aggregated dashboard data with caching and deduplication. */
export function useDashboard() {
  return useQuery<DashboardData>("dashboard", fetchDashboard, { ttl: 30_000 });
}
