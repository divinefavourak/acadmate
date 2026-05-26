# Acadmate — Architecture Notes

> Last updated: 2026-05-26

---

## 1. System Overview

```
Browser
  └── Next.js App Router (Vercel) — port 3000
        ├── middleware.ts          — JWT-based route guarding (edge runtime)
        ├── app/                   — Pages & layouts (App Router)
        ├── lib/api/client.ts      — Typed fetch wrapper (auth, timeout, requestId)
        ├── lib/api/query.ts       — In-memory request cache (TTL, dedup, retry)
        ├── lib/hooks/             — Domain-specific data hooks
        └── lib/api/auth.ts        — Token memory store + cookie relay helpers

NestJS API (Render) — port 4000 (configurable via PORT env)
  ├── RequestIdMiddleware          — Generates / echoes X-Request-Id
  ├── JwtAuthGuard                 — Validates Bearer token on protected routes
  ├── RolesGuard                   — Enforces ADMIN role on admin routes
  ├── ValidationPipe               — Zod-equivalent DTO validation
  ├── HttpExceptionFilter          — Standardised error envelope
  ├── LoggingInterceptor           — Structured JSON logs per request
  └── modules/                     — Feature modules (auth, exams, analytics, …)

Neon PostgreSQL (Serverless)
  └── Prisma ORM (both Next.js API routes and NestJS)
```

---

## 2. Frontend–Backend Contract

### Authentication

The JWT is issued by NestJS (`/api/auth/login`, `/api/auth/callback`) and:

1. **Stored in memory** (`lib/api/auth.ts:_memoryToken`) for the current tab session.
2. **Mirrored as an HttpOnly cookie** on the Render domain (`acadmate-api`) — enables `credentials: 'include'` cross-origin requests.
3. **Mirrored as a cookie on the Vercel domain** via `/api/auth/set-cookie` — enables `middleware.ts` (Next.js edge) to read it for route protection.

**Token lifecycle:**
```
Login → NestJS issues JWT
     → client sets memory token (setToken)
     → client calls /api/auth/set-cookie (relayTokenToFrontend)
     → NestJS sets HttpOnly cookie on its own domain

Logout → removeToken() clears memory
       → /api/auth/logout clears NestJS cookie
       → /api/auth/set-cookie DELETE clears Vercel cookie
```

### Request Correlation

Every `apiClient()` call generates a `X-Request-Id` UUID (or accepts a caller-supplied one). This ID is:
- Sent as `X-Request-Id` request header.
- Read by `RequestIdMiddleware` and attached to `req.requestId`.
- Echoed back in the `X-Request-Id` response header.
- Included in all error responses: `{ ..., requestId: "..." }`.
- Surfaced in `ApiError.requestId` for the frontend to log.

### Error Envelope (backend → frontend)

All API errors follow this shape:
```json
{
  "statusCode": 422,
  "message": "Email is already registered",
  "error": "Conflict",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-05-26T12:00:00.000Z"
}
```

Success responses return **bare data** (no wrapper) — this keeps the frontend types simple and avoids unwrapping boilerplate.

---

## 3. Request Lifecycle

```
Component renders
  │
  ├─ useQuery(key, fetcher, { ttl })       ← lib/hooks/useQuery.ts
  │     │
  │     └─ query(key, fetcher, opts)       ← lib/api/query.ts
  │           │
  │           ├─ Cache hit (< ttl)?  → return cached data (synchronous)
  │           ├─ In-flight request?  → join existing Promise (dedup)
  │           └─ Cache miss          → apiClient(path)
  │                                        │
  │                                        ├─ Attach X-Request-Id header
  │                                        ├─ Attach Authorization: Bearer <token>
  │                                        ├─ AbortController (15 s default timeout)
  │                                        └─ fetch(BASE_URL + path, ...)
  │                                               │
  │                                        NestJS RequestIdMiddleware
  │                                               │ echoes X-Request-Id back
  │                                        NestJS JwtAuthGuard
  │                                               │ validates JWT
  │                                        Controller → Service → Prisma
  │                                               │
  │                                        HTTP Response
  │                                               │
  │                                        apiClient parses JSON / handles errors
  │                                               │
  │                                        query.ts stores result in cache
  │                                               │
  Component receives { data, loading, error }
```

---

## 4. Auth Flow

```
Unauthenticated user visits /dashboard
  → middleware.ts: no acadmate_token cookie → redirect /login?callbackUrl=/dashboard

User submits login form
  → POST /api/auth/login
  → NestJS: validates credentials, issues JWT
  → client: setToken(jwt), relayTokenToFrontend(jwt)
  → redirect to callbackUrl (/dashboard)

Authenticated user visits /login
  → middleware.ts: valid cookie → redirect /dashboard (or /admin for ADMIN role)

Token expires (401 response)
  → apiClient: on401 = 'redirect' (default) → removeToken(), redirect /login
  → apiClient: on401 = 'throw' (opt-in) → caller handles error

Admin user visits /student-page
  → middleware.ts: role === 'ADMIN', not an admin route → NextResponse.next() (allowed)

Student visits /admin
  → middleware.ts: role !== 'ADMIN', route is admin → 403 Forbidden
```

---

## 5. Caching Strategy

### Frontend (lib/api/query.ts)

| Layer | Mechanism | TTL | Scope |
|---|---|---|---|
| In-memory | `Map<key, {data, timestamp}>` | Configurable (default 30 s) | One browser tab |
| Deduplication | `Map<key, Promise>` | Duration of in-flight request | One browser tab |

**Cache invalidation:** call `invalidate(keyOrPrefix)` after mutations. E.g. after submitting an exam, call `invalidate('dashboard')` to ensure the next dashboard load reflects the new result.

**On logout:** call `clearCache()` from `lib/api/query.ts` to purge all entries.

### Backend (analytics.service.ts)

The analytics service has a 60 s in-process `Map` cache keyed by `userId`. This means a user's analytics are at most 60 s stale. The cache is invalidated explicitly after exam submission via `AnalyticsService.invalidateCache(userId)`.

---

## 6. Middleware Route Policy

Routes are configured in `middleware.ts` using `ROUTE_POLICY`:

```typescript
const ROUTE_POLICY = {
  public:       [...],  // no JWT required
  authRedirect: [...],  // public routes that redirect logged-in users
  admin:        [...],  // requires ADMIN role
};
```

**To add a new public route:** add it to `ROUTE_POLICY.public`.
**To add a new admin route:** add it to `ROUTE_POLICY.admin`.
**No logic changes required.**

---

## 7. Extension Guidelines

### Adding a new feature module

1. **Backend:** Create `src/modules/<feature>/` with controller, service, module, DTOs.
2. **Register** in `app.module.ts`.
3. **Frontend hook:** Create `lib/hooks/use<Feature>.ts` using `useQuery` + `apiClient`.
4. **Cache key:** Use `'<feature>'` or `'<feature>:<id>'` for resource-scoped caches.
5. **Invalidation:** Call `invalidate('<feature>')` after any mutation.

### Adding a new admin-only route

```typescript
// middleware.ts — ROUTE_POLICY.admin
admin: ["/admin", "/api/admin", "/api/new-admin-feature"],
```

No logic changes needed.

### Adopting the query cache in an existing page

```typescript
// Before
useEffect(() => {
  apiClient<MyData>("/api/my-endpoint").then(setData).catch(handleError).finally(() => setLoading(false));
}, []);

// After
const { data, loading, error, refetch } = useQuery(
  "my-endpoint",
  () => apiClient<MyData>("/api/my-endpoint"),
  { ttl: 60_000 },
);
```
