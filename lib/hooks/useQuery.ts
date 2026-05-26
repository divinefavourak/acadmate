"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { query, QueryOptions } from "@/lib/api/query";

export interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseQueryOptions extends QueryOptions {
  /** Set to false to skip fetching until a condition is met. Default: true */
  enabled?: boolean;
}

/**
 * Thin React hook over the lib/api/query cache.
 * Provides deduplication, TTL, retry, and stable loading/error states.
 *
 * @param key    Cache key (null suspends fetching).
 * @param fetcher Function that returns a Promise<T>. Stable reference not required.
 * @param options TTL, retry, and enabled flag.
 */
export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {},
): UseQueryResult<T> {
  const { enabled = true, ...queryOptions } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled && key !== null);
  const [error, setError] = useState<Error | null>(null);

  // Keep the fetcher ref current so callers don't need to memoize it.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(() => {
    if (!key) return;
    setLoading(true);
    setError(null);
    query<T>(key, () => fetcherRef.current(), queryOptions)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
  // queryOptions spread is stable across renders for simple literals — the
  // important dependency is `key`, which controls whether we re-fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!enabled || !key) {
      setLoading(false);
      return;
    }
    execute();
  }, [execute, enabled, key]);

  return { data, loading, error, refetch: execute };
}
