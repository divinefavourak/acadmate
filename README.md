# Acadmate

Nigeria's student success platform — JAMB & Post-UTME CBT practice, school news, scholarship alerts, career guides, and a literature companion, all in one place.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, Framer Motion |
| Backend | NestJS, Passport JWT, Prisma ORM |
| Database | Neon PostgreSQL (pooled via PgBouncer) |
| Auth | Custom JWT — HttpOnly cookies + in-memory token; Google OAuth |
| Storage | Cloudinary (images) |
| Email | Nodemailer (SMTP — Brevo / Gmail App Password) |
| Rendering | react-katex + remark-math + rehype-katex (LaTeX) |
| Analytics | Vercel Analytics |
| Deployment | Vercel (frontend) + Render (backend) |

## Project Structure

```
acadmate/               ← Next.js 15 frontend
acadmate-api/           ← NestJS backend
```

## Getting Started

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Install backend dependencies

```bash
cd acadmate-api && npm install
```

### 3. Set up environment variables

**Frontend** — copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001   # NestJS backend URL
JWT_SECRET=                                 # must match backend JWT_SECRET
```

**Backend** — copy `acadmate-api/.env.example` to `acadmate-api/.env`:

```env
DATABASE_URL=           # Neon pooled connection string
DIRECT_URL=             # Neon direct connection string (for migrations)
JWT_SECRET=             # long random secret
JWT_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=              # Gmail address
SMTP_PASS=              # Gmail App Password (16 chars, not your login password)
SMTP_FROM=Acadmate <noreply@yourdomain.com>
```

### 4. Run the database migrations

```bash
cd acadmate-api && npx prisma migrate dev
```

### 5. Start development servers

```bash
# Terminal 1 — Next.js frontend (port 3000)
npm run dev

# Terminal 2 — NestJS backend (port 3001)
cd acadmate-api && npm run start:dev
```

## Key Scripts

### Frontend

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |

### Backend

| Script | Description |
|---|---|
| `npm run start:dev` | Start with hot-reload |
| `npm run build` | Compile TypeScript |
| `npx prisma migrate dev` | Run migrations |
| `npx prisma studio` | Open Prisma Studio |

## Features

- **CBT Engine** — timed 2-hour JAMB mock exams and Post-UTME 30-minute sessions with real past questions
- **8,600+ Past Questions** — 11 subjects from 1978–2024, all with verified answers and AI explanations
- **Post-UTME Prep** — practice papers for UNILAG, UI, OAU, UNIBEN, ABU and UNN
- **Blog & News** — school news, scholarship alerts, study tips and career guides with email notifications for Premium users
- **LaTeX Rendering** — full KaTeX support for mathematical questions in exams and blog posts
- **Analytics** — score trends, subject accuracy, weak-topic detection, and national leaderboard
- **Literature Guide** — summaries, character analysis and predicted exam questions for UTME prose texts
- **Paywall & Access Tokens** — free tier + Premium plan with token-based admin upgrade flow
- **Google OAuth** — one-click sign-in; no password required
- **PWA** — installable on mobile with offline-ready manifest
- **Admin Panel** — question import (CSV/JSON), blog publish workflow, user and token management

## Deployment

The frontend deploys to **Vercel** and the backend deploys to **Render** (Docker).

### Critical env vars to set

**Vercel (frontend):**
- `NEXT_PUBLIC_API_URL` — your Render backend URL (e.g. `https://acadmate-api.onrender.com`)
- `JWT_SECRET` — same value as the backend (used by Next.js middleware to verify route access)

**Render (backend):** set all vars from `acadmate-api/.env.example` that are marked `sync: false` in `render.yaml`.

> **Gmail SMTP:** `SMTP_PASS` must be a 16-character **App Password**, not your Gmail login password. Generate one at myaccount.google.com → Security → App Passwords.
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/divinefavourak/acadmate?utm_source=oss&utm_medium=github&utm_campaign=divinefavourak%2Facadmate&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)