# Acadmate — Site Handoff Document

> **Last updated**: 2026-05-12  
> **Platform**: Nigeria JAMB CBT practice platform  
> **Stack**: Next.js 16 (frontend) + NestJS 10 (backend) + PostgreSQL (Neon) + Prisma 6

---

## 1. What the Product Does

Acadmate is a Computer-Based Test (CBT) prep platform for Nigerian students preparing for JAMB UTME and Post-UTME exams. Core features:

- **8,600+ past questions** (1978–2024) across 11 UTME subjects
- **Timed 2-hour mock exams** replicating real JAMB conditions
- **AI-powered explanations** with LaTeX math rendering
- **Post-UTME prep** for 6 universities (UNILAG, UI, OAU, UNIBEN, ABU, UNN)
- **Literature guide** for *The Lekki Headmaster* UTME prose text
- **Real-time leaderboard** (UTME & Post-UTME separate)
- **Admin panel** for question imports, publishing, student management, and blog

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 16.2.3 (App Router, TypeScript) |
| UI / Styling | Tailwind CSS 4, Heroicons, Framer Motion |
| Math rendering | react-katex, react-markdown (GFM) |
| Avatar picker | react-nice-avatar |
| Analytics | Vercel Analytics |
| Backend framework | NestJS 10.4.15 (TypeScript, modular) |
| Database | PostgreSQL via Prisma ORM 6.6.0 (Neon cloud) |
| Auth | JWT (NestJS Passport) + Google OAuth 2.0 |
| Security | Helmet, Throttler rate limiting, CORS, bcryptjs |
| Validation | class-validator, class-transformer, Zod (frontend) |
| Email | Nodemailer (Gmail SMTP) |
| File storage | Cloudinary CDN |
| Scheduled jobs | @nestjs/schedule (cron — exam expiry, notifications) |
| API docs | Swagger/OpenAPI at `/api/docs` (dev only) |
| Deployment | Vercel (frontend), any Node host (backend, e.g. Render/Railway) |

---

## 3. Repository Structure

```
acadmate/
├── app/                          # Next.js App Router pages
│   ├── (auth)/                   # Login, register, forgot/reset password
│   ├── (public)/page.tsx         # Public landing page
│   ├── auth/callback/page.tsx    # Google OAuth callback handler
│   ├── dashboard/                # Student dashboard, profile, upgrade, leaderboard
│   ├── exam/                     # Exam creation, live exam UI, Post-UTME picker
│   ├── results/                  # Results history + detailed breakdown
│   ├── analytics/page.tsx        # Student analytics (trends, weak topics)
│   ├── my-flags/page.tsx         # Questions flagged by student
│   ├── prose/                    # Literature guide (list + detail)
│   ├── blog/                     # Blog (public — list + detail)
│   ├── admin/                    # Admin panel (all sub-pages)
│   └── components/               # Shared UI components
│
├── acadmate-api/                 # NestJS backend
│   └── src/
│       ├── main.ts               # App bootstrap — listens on port 3001
│       ├── app.module.ts         # Root module
│       ├── modules/
│       │   ├── auth/             # JWT + Google OAuth
│       │   ├── users/            # Profile, onboarding, plan, token redemption
│       │   ├── exams/            # Exam creation, answers, submission, expiry cron
│       │   ├── questions/        # Browse published questions, flag
│       │   ├── results/          # Result retrieval and breakdown
│       │   ├── analytics/        # Performance trends, weak-topic detection
│       │   ├── subjects/         # Subject & topic listing
│       │   ├── prose/            # Literature texts
│       │   ├── flags/            # Question flag submissions
│       │   ├── leaderboard/      # UTME & Post-UTME rankings
│       │   ├── blog/             # Public blog
│       │   ├── upload/           # Cloudinary file upload
│       │   ├── scheduler/        # Cron jobs
│       │   └── admin/            # Admin sub-modules (questions, imports, subjects,
│       │                         #   prose, blog, tokens, students, notifications,
│       │                         #   stats, leaderboard)
│       └── common/               # Guards, decorators, filters, interceptors, middleware
│
├── prisma/                       # Prisma schema, migrations, seed scripts
│   ├── schema.prisma
│   ├── seed.ts                   # Base subjects & topics
│   ├── seed-jamb-questions.ts    # 8,600+ JAMB questions
│   └── seed-lekki-text.ts        # The Lekki Headmaster prose + sections
│
├── lib/
│   ├── api/client.ts             # apiClient<T>() — central fetch wrapper with JWT injection
│   ├── api/auth.ts               # getToken / setToken / removeToken (localStorage)
│   ├── auth/auth.config.ts       # NextAuth edge config
│   ├── services/                 # exam-factory, import validation
│   ├── validation/               # Zod schemas (auth, exams, questions)
│   ├── utils/scoring.ts          # Score calculation
│   └── motion.ts                 # Framer Motion animation presets
│
├── features/post-utme/           # Post-UTME constants, types, API helpers
├── middleware.ts                 # JWT validation + route protection (Next.js)
├── next.config.ts
├── package.json
└── render.yaml                   # Deployment config
```

---

## 4. Database Schema

All models live in `prisma/schema.prisma`.

### Core Models

| Model | Purpose |
|-------|---------|
| `User` | Student/Admin accounts. Fields: `id`, `email`, `passwordHash`, `role` (STUDENT/ADMIN), `plan` (FREE/PREMIUM), `onboardedAt` |
| `StudentProfile` | Student metadata: `age`, `targetYear`, `courseChoice`, `institution`, `avatarConfig`, `avatarUrl`, `courseSubjectCombinations` |
| `Account` | OAuth credentials (Google). Fields: `provider`, `providerAccountId` |
| `AccessToken` | Premium upgrade codes: `code` (unique), `generatedById`, `usedById`, `usedAt` |
| `Subject` | JAMB subjects (Math, English, etc.) with `sortOrder` |
| `Topic` | Topics within a subject |
| `Question` | Exam questions: `text`, `year`, `difficulty`, `sourceType`, `isPublished`, `imageUrl`, `examType` (JAMB/WAEC/POST_UTME), `school`, `flagCount` |
| `QuestionOption` | Multiple-choice options A–D: `label`, `text`, `isCorrect` |
| `Explanation` | Solution text per question: `text`, `aiAssisted`, `reviewed` |
| `ProseText` | Literature text (e.g. *The Lekki Headmaster*): `title`, `author`, `year`, `summary`, `themes` |
| `ProseSection` | Chapters / character-analysis sections within a prose text |
| `ExamTemplate` | Pre-defined exam configs: `name`, `durationMinutes`, `totalQuestions` |
| `ExamTemplateSubject` | Question-count-per-subject distribution within a template |
| `ExamSession` | One student exam attempt: `mode`, `status`, `startedAt`, `submittedAt`, `expiresAt` |
| `ExamSessionQuestion` | Questions assigned to a session (position, mark-for-review flag) |
| `UserAnswer` | Student's answer per question: `optionId`, `isCorrect` |
| `Result` | Exam result summary: `correct`, `incorrect`, `unanswered`, `score`, `subjectBreakdown` (JSON), `topicBreakdown` (JSON) |
| `ResultSubjectBreakdown` | Subject-level breakdown (normalized) |
| `ResultTopicBreakdown` | Topic-level breakdown (normalized) |
| `CourseSubjectCombination` | Student's 3-subject UTME combo |
| `QuestionFlag` | Student-reported issues: `questionId`, `userId`, `resolved`, `resolvedAt` |
| `Import` | Bulk import job: `filename`, `format` (CSV/JSON), `status`, `totalRows`, `validRows`, `publishedRows` |
| `AdminActivityLog` | Audit trail of admin actions |
| `AdminNotification` | In-app notifications (flagged questions, etc.) |
| `BlogPost` | Blog articles: `slug`, `title`, `body`, `coverImageUrl`, `category`, `authorId`, `publishedAt` |

### Key Enums

| Enum | Values |
|------|--------|
| `Role` | `STUDENT`, `ADMIN` |
| `Plan` | `FREE`, `PREMIUM` |
| `ExamMode` | `MOCK` (2-hr full exam), `PRACTICE` (subject), `TOPIC` (topic drill), `POST_UTME` |
| `ExamStatus` | `IN_PROGRESS`, `SUBMITTED`, `TIMED_OUT`, `ABANDONED` |
| `ExamType` | `JAMB`, `WAEC`, `POST_UTME` |
| `Difficulty` | `EASY`, `MEDIUM`, `HARD` |
| `SourceType` | `MANUAL`, `IMPORTED`, `AI_ASSISTED` |
| `ImportStatus` | `PENDING`, `PROCESSING`, `DONE`, `FAILED` |
| `BlogCategory` | `UTME`, `POST_UTME`, `JAMB`, `SCHOOL_NEWS`, `STUDY_TIPS`, `SCHOLARSHIPS`, `CAREER`, `ANNOUNCEMENT`, `GENERAL` |

---

## 5. Authentication & Authorization

### Flow

1. **Email/password register** → `POST /api/auth/register` → bcrypt hash → user created
2. **Email/password login** → `POST /api/auth/login` → verify hash → JWT issued → stored in HTTP-only cookie `acadmate_token` (7-day expiry)
3. **Google OAuth** → redirect to `GET /api/auth/google` → Google consent page → `GET /api/auth/google/callback` → JWT issued → redirect to frontend with token in URL param → `app/auth/callback/page.tsx` stores token

### JWT Lifecycle

- **Issued by**: NestJS (`auth.service.ts` via `@nestjs/jwt`)
- **Storage**: HTTP-only cookie `acadmate_token` (set by backend) + `localStorage` (set by frontend callback handler)
- **Validated on API calls**: `lib/api/client.ts` reads from localStorage via `getToken()` and adds `Authorization: Bearer {token}` header
- **Validated on page load**: `middleware.ts` reads cookie and calls `jose.jwtVerify()`

### Route Protection (Next.js middleware)

Public (no auth): `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/blog/*`

Auth required: all `/dashboard/*`, `/exam/*`, `/results/*`, `/analytics`, `/my-flags`, `/prose/*`

Admin only: all `/admin/*` — middleware checks `role === "ADMIN"` in JWT payload

### NestJS Guards

- `JwtAuthGuard` — validates token, populates `@CurrentUser()` decorator on every protected endpoint
- `RolesGuard` + `@Roles('ADMIN')` — restricts admin module endpoints

### Plan Enforcement

- **FREE plan**: max 20 questions per session, PRACTICE/TOPIC modes only
- **PREMIUM plan**: unlimited questions, MOCK and POST_UTME unlocked
- Enforcement: controller returns `402 Payment Required` if free user attempts MOCK/POST_UTME
- Upgrade path: admin generates access code at `/admin/tokens` → student redeems at `/dashboard/upgrade` via `POST /api/users/me/redeem-token`

---

## 6. Full API Reference

### Public (no auth)

```
GET  /health                                # Liveness check
GET  /api/blog                              # List published blog posts
GET  /api/blog/:slug                        # Single blog post
```

### Auth

```
POST /api/auth/register                     # Create student account
POST /api/auth/login                        # Email/password login → sets cookie
POST /api/auth/logout                       # Clears session cookie
POST /api/auth/forgot-password              # Send password-reset email
POST /api/auth/reset-password              # Complete password reset (token in body)
GET  /api/auth/google                       # Redirect to Google consent
GET  /api/auth/google/callback             # OAuth callback → JWT → redirect to frontend
```

### Student (JWT required)

```
# Profile
GET    /api/users/me                        # Fetch current user + student profile
PATCH  /api/users/me                        # Update name, age, institution, avatar
DELETE /api/users/me                        # Delete own account
POST   /api/users/me/onboarding             # Complete first-time setup (subjects, institution)
POST   /api/users/me/redeem-token           # Redeem access code → PREMIUM plan
GET    /api/users/me/plan                   # Get current plan (FREE/PREMIUM)

# Exams
POST   /api/exams                           # Create exam session
GET    /api/exams                           # List user's sessions (history)
GET    /api/exams/active                    # List in-progress (resumable) sessions
GET    /api/exams/:id                       # Get session (questions, saved answers, timer state)
POST   /api/exams/:id/answers               # Save/auto-save answers (bulk array)
POST   /api/exams/:id/submit                # Submit → generate Result
PATCH  /api/exams/:id/review                # Toggle mark-for-review flag on a question

# Questions
GET    /api/questions                       # Browse published questions
                                            #   ?subjectId= &topicId= &difficulty= &examType= &school=
GET    /api/questions/:id                   # Question detail + options + explanation
POST   /api/questions/:id/flag              # Flag question as problematic

# Results
GET    /api/results                         # Paginated results list
GET    /api/results/:id                     # Result detail with subject/topic breakdowns

# Analytics
GET    /api/analytics                       # Performance trends, avg scores, weak topics

# Subjects & Topics
GET    /api/subjects                        # List all active subjects
GET    /api/topics?subjectId=:id            # List topics for a subject

# Prose
GET    /api/prose                           # List published prose texts
GET    /api/prose/:id                       # Prose detail with all sections

# Leaderboard
GET    /api/leaderboard?type=UTME           # UTME rankings
GET    /api/leaderboard?type=POST_UTME      # Post-UTME rankings

# Upload (for profile images)
POST   /api/upload?folder=questions|blog    # Upload image → returns Cloudinary URL
```

### Admin (JWT + ADMIN role required)

```
# Dashboard
GET    /api/admin/stats                     # Platform overview (counts, recent activity)

# Questions
GET    /api/admin/questions                 # List all questions (filterable)
GET    /api/admin/questions/:id             # Question detail
POST   /api/admin/questions                 # Create question
PATCH  /api/admin/questions/:id             # Update question
DELETE /api/admin/questions/:id             # Delete question
PATCH  /api/admin/questions/:id/publish     # Toggle publish status
PATCH  /api/admin/questions/:id/resolve-flag # Resolve all flags on question

# Bulk Import
POST   /api/admin/imports                   # Process import (JSON rows → validate → store)
GET    /api/admin/imports                   # List import jobs
POST   /api/admin/imports/:id/publish       # Publish all valid rows from import

# Subjects
GET    /api/admin/subjects
POST   /api/admin/subjects
PATCH  /api/admin/subjects/:id
DELETE /api/admin/subjects/:id

# Prose
GET    /api/admin/prose
POST   /api/admin/prose
PATCH  /api/admin/prose/:id
DELETE /api/admin/prose/:id

# Blog
GET    /api/admin/blog
POST   /api/admin/blog
GET    /api/admin/blog/:id
PATCH  /api/admin/blog/:id
DELETE /api/admin/blog/:id

# Students
GET    /api/admin/students
PATCH  /api/admin/students/:id
DELETE /api/admin/students/:id

# Access Tokens
POST   /api/admin/tokens                    # Generate premium access code
GET    /api/admin/tokens                    # List all tokens (used/unused)

# Notifications
GET    /api/admin/notifications             # List flagged-question notifications
PATCH  /api/admin/notifications/:id        # Mark notification as read

# Leaderboard
GET    /api/admin/leaderboard?type=UTME
GET    /api/admin/leaderboard?type=POST_UTME
```

---

## 7. Frontend Pages

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `/` | `app/(public)/page.tsx` | Public | Landing (hero, features, pricing) |
| `/login` | `app/(auth)/login/page.tsx` | Public | Sign in (email or Google) |
| `/register` | `app/(auth)/register/page.tsx` | Public | Create account |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Public | Request password reset email |
| `/reset-password` | `app/(auth)/reset-password/page.tsx` | Public | Complete reset with token |
| `/auth/callback` | `app/auth/callback/page.tsx` | Public | Google OAuth token handler |
| `/blog` | `app/blog/page.tsx` | Public | Blog listing by category |
| `/blog/:slug` | `app/blog/[slug]/page.tsx` | Public | Blog post |
| `/dashboard` | `app/dashboard/page.tsx` | Auth | Overview (recent exams, stats) |
| `/dashboard/profile` | `app/dashboard/profile/page.tsx` | Auth | Edit profile (age, institution, subjects, avatar) |
| `/dashboard/upgrade` | `app/dashboard/upgrade/page.tsx` | Auth | Redeem premium access code |
| `/dashboard/leaderboard` | `app/dashboard/leaderboard/page.tsx` | Auth | UTME leaderboard |
| `/dashboard/leaderboard/post-utme` | sub-page | Auth | Post-UTME leaderboard |
| `/exam/new` | `app/exam/new/page.tsx` | Auth | Create exam (mode, subjects) |
| `/exam/:id` | `app/exam/[id]/page.tsx` | Auth | Live exam (timer, question grid, answers) |
| `/exam/post-utme/schools` | sub-page | Auth | Pick school for Post-UTME |
| `/exam/post-utme/packs` | sub-page | Auth | Pick year/pack |
| `/results` | `app/results/page.tsx` | Auth | Results history |
| `/results/:id` | `app/results/[id]/page.tsx` | Auth | Result detail + breakdowns |
| `/analytics` | `app/analytics/page.tsx` | Auth | Performance analytics |
| `/my-flags` | `app/my-flags/page.tsx` | Auth | My flagged questions |
| `/prose` | `app/prose/page.tsx` | Auth | Literature guide list |
| `/prose/:id` | `app/prose/[id]/page.tsx` | Auth | Prose detail + sections |
| `/admin` | `app/admin/page.tsx` | Admin | Platform stats overview |
| `/admin/questions` | `app/admin/questions/page.tsx` | Admin | Question manager |
| `/admin/subjects` | `app/admin/subjects/page.tsx` | Admin | Subject & topic management |
| `/admin/imports` | `app/admin/imports/page.tsx` | Admin | Bulk import workflow |
| `/admin/prose` | `app/admin/prose/page.tsx` | Admin | Prose text management |
| `/admin/blog` | `app/admin/blog/page.tsx` | Admin | Blog post list |
| `/admin/blog/new` | sub-page | Admin | Create blog post |
| `/admin/blog/:id` | `app/admin/blog/[id]/page.tsx` | Admin | Edit blog post |
| `/admin/students` | `app/admin/students/page.tsx` | Admin | Student list & management |
| `/admin/tokens` | `app/admin/tokens/page.tsx` | Admin | Generate access codes |
| `/admin/leaderboard` | sub-page | Admin | UTME leaderboard (admin view) |
| `/admin/leaderboard/post-utme` | sub-page | Admin | Post-UTME leaderboard (admin view) |
| `/admin/notifications` | `app/admin/notifications/page.tsx` | Admin | Flagged question notifications |

---

## 8. How the Frontend Calls the Backend

All API calls go through `lib/api/client.ts`:

```typescript
// Signature
async function apiClient<T>(path: string, options?: RequestInit): Promise<T>

// Examples
const profile = await apiClient<User>("/api/users/me");

const session = await apiClient<{ examSession: ExamSession }>("/api/exams", {
  method: "POST",
  body: JSON.stringify({ mode: "MOCK", subjectIds: ["id1", "id2"] }),
});

// Error handling — 402 = paywall
try {
  await apiClient("/api/exams/:id/submit", { method: "POST" });
} catch (err) {
  if (err instanceof ApiError && err.status === 402) router.push("/dashboard/upgrade");
}
```

The client:
1. Reads JWT from `localStorage` via `getToken()`
2. Adds `Authorization: Bearer {token}` and `Content-Type: application/json`
3. Includes `credentials: "include"` (for HTTP-only cookie)
4. On `401` — clears token and redirects to `/login`

---

## 9. Third-Party Integrations

### Cloudinary
- **Purpose**: Question images, blog cover images, avatar uploads
- **Upload endpoint**: `POST /api/upload?folder=questions|blog`
- **Env vars needed**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Google OAuth 2.0
- **Purpose**: Social login
- **Redirect URI to configure in Google Console**: `{API_URL}/api/auth/google/callback`
- **Env vars needed**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Nodemailer / Gmail SMTP
- **Purpose**: Password reset emails
- **Requires**: Gmail account with 2FA enabled, app password generated
- **Env vars needed**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### Vercel Analytics
- **Purpose**: Frontend page-view tracking
- **Setup**: Automatic — `@vercel/analytics/react` imported in root layout

---

## 10. Environment Variables

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001   # NestJS API base URL
NEXTAUTH_URL=http://localhost:3000          # Frontend base URL
NEXTAUTH_SECRET=<random-32-char-string>     # JWT signing secret
```

### Backend (`acadmate-api/.env`)

```env
# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DIRECT_URL=postgresql://user:pass@host/db?sslmode=require

# JWT
JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# Google OAuth
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<gmail>
SMTP_PASS=<app-password>
SMTP_FROM="Acadmate <noreply@acadmate.app>"

# App URLs
PORT=3001
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

---

## 11. Security Configuration

| Concern | Implementation |
|---------|---------------|
| Password hashing | bcryptjs, 10 salt rounds |
| JWT secret | Long random string — rotate in production |
| Auth cookie | HTTP-only, `SameSite=lax`, 7-day expiry |
| CORS | Only `FRONTEND_URL` origin allowed |
| Security headers | Helmet (CSP, X-Frame-Options, etc.) |
| Input validation | class-validator DTOs (backend), Zod (frontend) |
| Rate limiting | 100 req/60s global; 5 req/60s on auth endpoints; 10 req/60s on exam submit |
| Admin access | Role guard (`ADMIN`) on all `/api/admin/*` routes + Next.js middleware for `/admin/*` |
| OAuth state | Passport.js handles CSRF state parameter automatically |

---

## 12. Rate Limits

| Scope | Limit |
|-------|-------|
| Global | 100 requests / 60 seconds |
| Auth endpoints | 5 requests / 60 seconds |
| Exam submission | 10 requests / 60 seconds |

Implemented via NestJS `ThrottlerModule` with named limits.

---

## 13. Scheduled Jobs (Cron)

Located in `acadmate-api/src/modules/scheduler/scheduler.service.ts`:

- **Exam expiry**: Marks `IN_PROGRESS` sessions as `TIMED_OUT` when `expiresAt` passes
- **Notifications**: Generates `AdminNotification` records when questions reach a flag threshold

---

## 14. Development Scripts

### Frontend

```bash
npm run dev                  # Dev server at http://localhost:3000
npm run build                # Production build
npm run start                # Start production server
npm run db:generate          # Regenerate Prisma client
npm run db:migrate           # Run migrations (dev)
npm run db:push              # Push schema changes without migration
npm run db:seed              # Seed subjects & topics
npm run db:seed:jamb         # Seed 8,600+ JAMB questions
npm run db:seed:lekki-text   # Seed The Lekki Headmaster prose
npm run db:studio            # Open Prisma Studio GUI
```

### Backend

```bash
npm run start:dev            # Dev server with hot reload at http://localhost:3001
npm run start:prod           # Production server
npm run build                # Compile TypeScript
npm run test                 # Jest unit tests
npm run db:migrate           # Run migrations
npm run db:studio            # Open Prisma Studio GUI
```

---

## 15. Key Admin Workflows

### Add a Question Manually
1. `/admin/questions` → "Create Question"
2. Fill: subject, topic, question text, options A–D (mark correct), explanation
3. Toggle "Published" when ready — students can now see it in PRACTICE mode

### Bulk Import Questions
1. `/admin/imports` → upload CSV or JSON file
2. System validates each row (required fields, correct answer count, etc.)
3. Review errors in the UI
4. Click "Publish All Valid" to make them live

### Generate a Premium Access Code
1. `/admin/tokens` → "Generate Token"
2. System creates a unique 24-character code
3. Share code with student (email, WhatsApp, etc.)
4. Student redeems at `/dashboard/upgrade` → account upgrades to PREMIUM

### Resolve a Flagged Question
1. `/admin/notifications` → click notification
2. Review the flagged question
3. Edit if needed via `/admin/questions`
4. Click "Resolve Flag" — clears all flags and marks notification as read

---

## 16. Getting Started (Local Dev)

```bash
# 1. Install dependencies
npm install
cd acadmate-api && npm install && cd ..

# 2. Configure env files
cp .env.example .env.local           # Fill in NEXT_PUBLIC_API_URL, NEXTAUTH_SECRET
cp acadmate-api/.env.example acadmate-api/.env  # Fill in all backend vars

# 3. Set up database
npm run db:migrate
npm run db:seed
npm run db:seed:jamb                 # ~8,600 questions — takes a few minutes

# 4. Start dev servers (two terminals)
npm run dev                          # Frontend: http://localhost:3000
cd acadmate-api && npm run start:dev # Backend:  http://localhost:3001

# 5. Swagger docs
open http://localhost:3001/api/docs
```

---

## 17. Deployment Overview

### Frontend (Vercel)
- Connect GitHub repo to Vercel
- Set env vars in Vercel dashboard (same as `.env.local`)
- Deploys automatically on push to main

### Backend (e.g. Render / Railway)
- Build: `npm run build`
- Start: `npm run start:prod`
- Run DB migrations before each deploy: `npx prisma migrate deploy`
- Set all backend env vars in the host dashboard
- Health check endpoint: `GET /health`

### Database (Neon)
- Neon handles connection pooling and automatic backups
- Use `DATABASE_URL` for pooled connections, `DIRECT_URL` for migrations
- Run `npx prisma migrate deploy` in CI/deploy pipeline

---

## 18. Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` on API calls | JWT expired or missing | Clear `acadmate_token` cookie in DevTools → re-login |
| CORS errors | `FRONTEND_URL` mismatch | Verify `FRONTEND_URL` env var in backend matches actual frontend origin |
| Images not loading | Cloudinary not configured | Add `CLOUDINARY_*` env vars |
| Exams never expire / timeout instantly | Scheduler not running | Restart backend (scheduler needs active Node process) |
| New questions not visible to students | Not published | Toggle "Published" in admin question manager |
| `402 Payment Required` on MOCK exam | User is on FREE plan | Redirect to `/dashboard/upgrade` to redeem access code |
| Migration fails | Schema out of sync | Run `npx prisma db push` (dev) or `npx prisma migrate deploy` (prod) |
| Swagger docs not showing | Production environment | Swagger only rendered when `NODE_ENV !== 'production'` |
| Google OAuth redirect mismatch | Wrong redirect URI | Add `{API_URL}/api/auth/google/callback` to Google Cloud Console OAuth credentials |
| Password reset email not sent | Gmail SMTP misconfigured | Verify 2FA enabled on Gmail, use App Password (not account password) |

---

## 19. Key File Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Full database schema |
| `middleware.ts` | JWT validation & route protection (Next.js edge) |
| `lib/api/client.ts` | Central fetch wrapper with auth injection |
| `lib/api/auth.ts` | `getToken` / `setToken` / `removeToken` |
| `app/(public)/page.tsx` | Public landing page |
| `app/exam/[id]/page.tsx` | Live exam UI (timer, question grid, auto-save) |
| `app/admin/imports/page.tsx` | Bulk import workflow |
| `acadmate-api/src/main.ts` | NestJS bootstrap (port, CORS, Swagger, Helmet) |
| `acadmate-api/src/modules/auth/auth.controller.ts` | All auth endpoints |
| `acadmate-api/src/modules/exams/exams.controller.ts` | Exam create / answer / submit |
| `acadmate-api/src/modules/exams/exam-factory.service.ts` | Question distribution logic |
| `acadmate-api/src/modules/exams/exam-expiry.service.ts` | Cron: expire timed-out sessions |
| `acadmate-api/src/modules/admin/questions/admin-questions.controller.ts` | Admin question endpoints |
| `acadmate-api/src/modules/admin/imports/` | Bulk import processing |
| `acadmate-api/src/common/guards/` | JwtAuthGuard, RolesGuard |
