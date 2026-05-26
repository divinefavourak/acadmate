// In-memory request cache for the current browser session.
// Provides: TTL-based staleness, in-flight deduplication, exponential-backoff retry.
// Scoped to one tab — clears on page reload.
//
// Usage:
//   import { query, invalidate } from '@/lib/api/query';
//   const data = await query('analytics', () => apiClient('/api/analytics'), { ttl: 30_000 });
//   invalidate('analytics'); // bust on mutation

export interface QueryOptions {
  /** How long (ms) before a cached result is considered stale. Default: 30 000 */
  ttl?: number;
  /** Max retry attempts on failure. Default: 2 */
  retries?: number;
  /** Initial retry delay in ms (doubles each attempt). Default: 500 */
  retryDelay?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise<void>((r) => setTimeout(r, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * Fetch `key` via `fetcher`, returning a cached result if still fresh.
 * Concurrent calls with the same key share a single in-flight promise.
 */
export async function query<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: QueryOptions = {},
): Promise<T> {
  const { ttl = 30_000, retries = 2, retryDelay = 500 } = options;

  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  // Return the existing promise if a request for this key is already in flight.
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = withRetry(fetcher, retries, retryDelay)
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err: unknown) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise as Promise<unknown>);
  return promise;
}

/**
 * Bust cache entries whose key equals `keyOrPrefix` or starts with `keyOrPrefix:`.
 * Call this after mutations that invalidate server-side data.
 */
export function invalidate(keyOrPrefix: string): void {
  for (const key of cache.keys()) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      cache.delete(key);
    }
  }
  for (const key of inflight.keys()) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      inflight.delete(key);
    }
  }
}

/** Wipe all cached entries (e.g. on logout). */
export function clearCache(): void {
  cache.clear();
  inflight.clear();
}
