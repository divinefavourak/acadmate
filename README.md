# Acadmate

Nigeria's student success platform: JAMB and Post-UTME CBT practice, live classes, a question bank with AI explanations, school news, scholarship alerts, a discussion forum, and a literature companion.

The repo holds two apps that share one Neon PostgreSQL database:

- `acadmate/` — the Next.js 16 frontend (this directory).
- `acadmate-api/` — the NestJS backend that serves everything under `/api`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19.2, Tailwind CSS v4, Framer Motion |
| Backend | NestJS 10, Prisma 6, Passport (JWT + Google OAuth) |
| Database | Neon PostgreSQL (pooled `DATABASE_URL` for runtime, `DIRECT_URL` for migrations) |
| Auth | Custom JWT in HttpOnly cookies, shared secret; Google OAuth |
| Caching | Redis via ioredis |
| Storage | Cloudinary (images) |
| Email | Gmail API (OAuth refresh token) |
| Math rendering | react-katex + remark-math + rehype-katex |
| AI tooling | Anthropic, OpenAI, Groq, and Gemini SDKs (content pipeline) |
| Hardening | Helmet, rate limiting (@nestjs/throttler), request-ID tracing |
| Scheduling | @nestjs/schedule (cron jobs) |
| Analytics | Vercel Analytics |
| Deployment | Vercel (frontend) + Render Docker (backend) |

## Features

- **CBT Engine:** timed JAMB mock exams and Post-UTME sessions built from real past questions, with per-question flagging.
- **Question Bank:** subjects, topics, options, and AI-written explanations, plus a user flag-and-review loop for bad questions.
- **Post-UTME Prep:** school-specific practice packs for UNILAG, UI, OAU, UNIBEN, ABU, and UNN.
- **Live Classes:** admins open a live session and students join with a code at `/live/{code}`.
- **Blog & News:** school news, scholarship alerts, study tips, and career guides, with a publish workflow that emails Premium users once per post.
- **Forum:** threaded student discussion.
- **Literature Guide:** summaries, character analysis, and predicted questions for UTME prose texts.
- **Analytics:** score trends, subject and topic breakdowns, weak-topic detection, and site-visit tracking.
- **Leaderboards:** separate UTME and Post-UTME rankings.
- **Paywall & Access Tokens:** a free tier plus a Premium plan that admins grant by issuing redeemable tokens.
- **Seasonal Availability:** admins toggle UTME and Post-UTME exam groups on or off from settings.
- **Admin Panel:** CSV/JSON question import, question and subject management, blog publishing, token and student management, notifications, and leaderboards.
- **Math Rendering:** full KaTeX support in exams and blog posts.

## Architecture

Both apps run their own Prisma client against the same Neon database. The frontend uses it for route-guard checks and seeding (`lib/db/prisma.ts`); the backend owns the schema and migrations. Next.js middleware verifies the JWT cookie on protected routes using a `JWT_SECRET` it shares with the backend, so keep that value identical in both environments.

The backend groups its domains into NestJS modules: `auth`, `users`, `exams`, `questions`, `subjects`, `results`, `analytics`, `leaderboard`, `live-sessions`, `blog`, `forum`, `prose`, `flags`, `upload`, `settings`, `scheduler`, and `admin`. A `ThrottlerGuard` rate-limits every route (100/min by default, tighter on auth and submit), Helmet sets security headers, and a request-ID middleware tags each request for tracing. In development it serves Swagger docs at `/api/docs`.

## Getting Started

### 1. Install dependencies

```bash
npm install                       # frontend
cd acadmate-api && npm install    # backend
```

### 2. Configure the frontend

Create `.env.local` in the repo root:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001   # NestJS backend URL
JWT_SECRET=                                 # must match the backend's JWT_SECRET
DATABASE_URL=                               # Neon pooled connection (frontend Prisma client)
DIRECT_URL=                                 # Neon direct connection (needed by the db:* scripts)
```

### 3. Configure the backend

Copy `acadmate-api/.env.example` to `acadmate-api/.env` and fill it in:

```env
DATABASE_URL=           # Neon pooled connection string
DIRECT_URL=             # Neon direct connection string (for migrations)

JWT_SECRET=             # long random secret, identical to the frontend
JWT_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000   # or ALLOWED_ORIGINS for multiple, comma-separated

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GMAIL_USER=                  # Gmail address that sends mail
GMAIL_REFRESH_TOKEN=         # OAuth refresh token with the gmail.send scope
SMTP_FROM=Acadmate <noreply@yourdomain.com>

PORT=3001
NODE_ENV=development
```

Generate `GMAIL_REFRESH_TOKEN` from the [OAuth Playground](https://developers.google.com/oauthplayground) using your own Google OAuth credentials and the `https://www.googleapis.com/auth/gmail.send` scope.

### 4. Run the migrations

```bash
cd acadmate-api && npm run db:migrate
```

### 5. Start both servers

```bash
# Terminal 1 — frontend on port 3000
npm run dev

# Terminal 2 — backend on port 3001
cd acadmate-api && npm run start:dev
```

## Scripts

### Frontend

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server (binds `0.0.0.0`) |
| `npm run build` | Generate the Prisma client, then build for production |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed base data |
| `npm run db:seed:jamb` | Seed JAMB questions (uses `GROQ_API_KEY`) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:backfill` | Backfill result breakdowns (`:dry`, `:verify` variants) |

### Backend

| Script | What it does |
|---|---|
| `npm run start:dev` | Start with hot reload |
| `npm run build` | Compile with the Nest CLI |
| `npm run test` | Run the Jest suite (`:watch`, `:cov`, `:e2e` variants) |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Prisma Studio |

## Content tooling

Standalone scripts at the repo root digitise question booklets and seed content with AI help. They read provider keys from the environment and run outside the app:

- `extract-questions.js` — turn booklet photos into import-ready JSON (`ANTHROPIC_API_KEY` or `GEMINI_API_KEY`).
- `repair-options.js`, `fix_questions.mjs` — clean up extracted questions.

## Deployment

Deploy the frontend to **Vercel** and the backend to **Render** as a Docker service (see [`render.yaml`](render.yaml)).

**Vercel (frontend)** — set `NEXT_PUBLIC_API_URL` to the Render backend URL, and set `JWT_SECRET`, `DATABASE_URL`, and `DIRECT_URL` to the same values the backend uses.

**Render (backend)** — set every var marked `sync: false` in `render.yaml`. The service exposes `/health` for health checks.

> **Gmail API:** the backend sends mail through the Gmail API, not SMTP. Set `GMAIL_USER` and `GMAIL_REFRESH_TOKEN`; the legacy `SMTP_*` keys in `render.yaml` are unused.

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/divinefavourak/acadmate?utm_source=oss&utm_medium=github&utm_campaign=divinefavourak%2Facadmate&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
