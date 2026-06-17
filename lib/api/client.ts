import { getToken, removeToken } from './auth';

if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.error('[apiClient] NEXT_PUBLIC_API_URL is not set — API calls will fail in production');
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// How long before a request is aborted (ms). Callers may override.
const DEFAULT_TIMEOUT_MS = 15_000;

// 'redirect': the legacy default — clears token and hard-navigates to /login.
// 'throw': lets the caller decide; useful for background refreshes or token-check calls.
type On401Behavior = 'redirect' | 'throw';

export type FetchOptions = RequestInit & {
  skipAuth?: boolean;
  timeout?: number;
  on401?: On401Behavior;
  requestId?: string;
};

export class ApiError extends Error {
  readonly category: 'client' | 'server';

  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown> = {},
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.category = status >= 500 ? 'server' : 'client';
  }
}

export async function apiClient<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const {
    skipAuth,
    timeout = DEFAULT_TIMEOUT_MS,
    on401 = 'redirect',
    requestId,
    ...init
  } = options;

  // Generate a correlation ID for this request. Sent upstream as X-Request-Id
  // and echoed back in error responses so logs can be correlated end-to-end.
  const reqId = requestId ?? crypto.randomUUID();

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Request-Id', reqId);

  if (!skipAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeout);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      // Caller-supplied signal takes precedence; fallback to our timeout signal.
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeout}ms`, 408, {}, reqId);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  // Prefer the server-echoed requestId if present (set by NestJS RequestIdMiddleware).
  const responseRequestId = res.headers.get('x-request-id') ?? reqId;

  if (res.status === 401) {
    removeToken();
    if (on401 === 'redirect' && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401, {}, responseRequestId);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const rawMessage = body.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : (rawMessage as string) ?? (body.error as string) ?? 'Request failed';
    throw new ApiError(message, res.status, body, responseRequestId);
  }

  if (res.status === 204) return undefined as never;

  // Guard against non-JSON responses (CDN/proxy HTML error pages).
  const text = await res.text();
  // An empty 200 body (e.g. a NestJS handler that returned null/undefined) is a
  // valid "no data" response, not a parse error — surface it as undefined.
  if (text === '') return undefined as never;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      `Server returned non-JSON response (status ${res.status})`,
      res.status,
      {},
      responseRequestId,
    );
  }
}
