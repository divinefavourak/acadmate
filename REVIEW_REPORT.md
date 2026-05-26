# Acadmate — Architecture & Performance Review

> Generated: 2026-05-26

---

## 1. Current Bottlenecks

### 1.1 Request Duplication & Waterfall Patterns

| Location | Issue | Impact |
|---|---|---|
| `app/dashboard/page.tsx` | Independent `useEffect` fires on every mount — no caching | Medium |
| `app/context/UserContext.tsx` | `fetchedRef` guard prevents double-fetch but provides no deduplication across sibling component mounts | Medium |
| Multiple admin pages | Each page independently fetches its own list with no shared cache | Low |
| Dashboard → analytics + results | Two sequential-ish calls via `Promise.allSettled` — no reuse if user navigates back | Medium |

**Before (request flow):**
```
Component mounts
  → useEffect fires
    → apiClient("/api/analytics")    [network]
    → apiClient("/api/results?limit=5") [network]
  → state set, re-render

User navigates away and back:
  → useEffect fires AGAIN
    → apiClient("/api/analytics")    [network again — cache miss]
    → apiClient("/api/results?limit=5") [network again — cache miss]
```

**After (with lib/api/query.ts + useDashboard hook):**
```
Component mounts
  → useDashboard() → query('dashboard', fetchDashboard, { ttl: 30_000 })
    → First mount: fires network request, stores result in memory cache
    → Concurrent mounts: share the same in-flight Promise (deduplication)
    → Subsequent mounts within 30 s: return cached data synchronously

User navigates away and back (within 30 s):
  → useDashboard() → query cache HIT — no network request
```

### 1.2 API Client Issues (pre-fix)

- **No request timeout**: A hung backend or slow CDN could block UI indefinitely.
- **Hard 401 redirect**: Every 401 (including background refresh attempts) immediately redirected to `/login` — callers had no override.
- **No request correlation**: `X-Request-Id` not propagated to/from server, making log correlation impossible.

### 1.3 Middleware Route Policy

- Route arrays were inline magic strings with no labelled structure.
- Adding a new public route required understanding the triple-array design (public / authRedirect / admin).
- No comments explaining the policy design intent.

### 1.4 Backend Response Consistency

**Good:** `HttpExceptionFilter` already produces a standardised error envelope:
```json
{ "statusCode": 422, "message": "...", "error": "Unprocessable Entity", "requestId": "...", "timestamp": "..." }
```

**Gap:** Success responses are bare data objects. This is fine and intentional (less wrapper overhead), but requestId was not echoed back in response headers, preventing frontend correlation.

**Gap:** `RequestIdMiddleware` generated a fresh UUID per request but did not honour a client-supplied `X-Request-Id`, so end-to-end correlation required both ends to emit their own IDs.

### 1.5 Admin Stats In-Memory Aggregation

`admin-stats.service.ts` fetches up to 1 000 result rows (`take: 1000`) and groups them in JavaScript. This is a known pattern but becomes expensive as the platform scales. Score distribution computation is O(n×bands) in memory.

The analytics service (`analytics.service.ts`) already has a 60 s in-process cache — this is a good pattern to replicate for admin stats.

---

## 2. Architecture Risks

| Risk | Severity | Notes |
|---|---|---|
| JWT secret not set at boot | High | `getSecret()` throws at runtime — add a startup assertion in `main.ts` |
| Memory token lost on hard refresh | Medium | Design intent (cookie fallback exists), but worth documenting |
| No pagination enforced on `/api/results` | Medium | Front-end sends `?limit=5` but the backend must validate the limit |
| `analytics.service.ts` in-process cache evicts on deploy | Low | OK for current scale, document as known limitation |
| Worktrees committed to git | Low | `.claude/worktrees/` appearing in `git status` suggests they were tracked before the `.gitignore` rule |

---

## 3. Prioritised Fixes (by impact)

### High

- [x] **Request timeout** — `AbortController` with 15 s default added to `apiClient`.
- [x] **Caller-controlled 401** — `on401: 'redirect' | 'throw'` option; redirect remains the default.
- [x] **Request ID correlation** — `X-Request-Id` generated client-side, sent as request header, echoed by `RequestIdMiddleware` as response header, surfaced in `ApiError.requestId`.
- [x] **Client-side caching** — `lib/api/query.ts` provides TTL, dedup, retry; `useDashboard` hook adopts it.

### Medium

- [x] **Middleware maintainability** — `ROUTE_POLICY` config object with inline comments.
- [x] **Dashboard waterfall** — `useDashboard` batches analytics + results in one logical fetch with 30 s cache.
- [x] **`.gitignore` hygiene** — Added `acadmate-api/dist/`, `.claude/worktrees/`.

### Low

- [ ] **Admin stats pagination** — Add `Cache-Control: private, max-age=60` header or a short-lived in-process cache (same pattern as `AnalyticsService`).
- [ ] **Backend startup assertion** — Fail fast if `JWT_SECRET` is unset: `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required')` in `main.ts`.
- [ ] **Adopt `useQuery` + domain hooks for admin pages** — Admin pages still use raw `useEffect`. The `useQuery` hook is available; migrate incrementally.

---

## 4. Verification Summary

### Commands to run

```bash
# Frontend
cd <repo-root>
npm run lint
npx tsc --noEmit

# Backend
cd acadmate-api
npm run lint
npx tsc --noEmit
npm run build
```

### Status at time of review

| Check | Result | Notes |
|---|---|---|
| Frontend TypeScript | ✅ PASS | `npx tsc --noEmit` — zero errors |
| Frontend ESLint | ✅ PASS | `npx eslint` on all modified/new files — zero warnings |
| Backend TypeScript | ✅ PASS | `npx tsc --noEmit` — zero errors |
| Backend build | ✅ PASS | Middleware change is backward-compatible |

### Residual items

1. Admin pages still use raw `useEffect` — not broken, but the `useQuery` hook is ready for incremental adoption.
2. `analytics.service.ts` in-memory aggregation is correct but does not benefit from the new frontend cache (it has its own server-side cache). No action needed.
3. JWT_SECRET startup assertion not yet added — low risk during development, should be done before first production deploy.
