import { getToken, removeToken } from './auth';

if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.error('[apiClient] NEXT_PUBLIC_API_URL is not set — API calls will fail in production');
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

type FetchOptions = RequestInit & { skipAuth?: boolean };

export class ApiError extends Error {
  readonly category: 'client' | 'server';

  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown> = {},
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
  const { skipAuth, ...init } = options;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const rawMessage = body.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : (rawMessage as string) ?? (body.error as string) ?? 'Request failed';
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as never;

  // Guard against non-JSON responses (CDN/proxy HTML error pages)
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(`Server returned non-JSON response (status ${res.status})`, res.status);
  }
}
