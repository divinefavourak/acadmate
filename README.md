# Acadmate Business Consult

Nigeria's JAMB CBT practice platform — timed mock exams, 8,600+ past questions (1978–2024), AI-powered explanations, and a literature guide for UTME prose texts.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth v5
- **AI**: Anthropic Claude SDK, Google Generative AI, Groq SDK
- **Storage**: Cloudinary
- **Analytics**: Vercel Analytics
- **UI**: Tailwind CSS, Heroicons, react-katex (LaTeX rendering)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env` (or create `.env`) and fill in:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 3. Set up the database

```bash
npm run db:migrate       # run migrations
npm run db:seed          # seed base data
npm run db:seed:jamb     # seed JAMB past questions
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (binds to 0.0.0.0) |
| `npm run build` | Generate Prisma client + build |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema without migration |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed base data |
| `npm run db:seed:jamb` | Seed JAMB questions dataset |
| `npm run db:seed:lekki-text` | Seed Lekki Headmaster literature text |

## Features

- **CBT Engine** — timed 2-hour mock exams replicating the real JAMB experience
- **Past Questions** — 8,600+ questions across 11 subjects from 1978–2024
- **AI Explanations** — step-by-step solutions with LaTeX math rendering
- **Analytics** — score trends, subject accuracy, weak-topic detection
- **Literature Guide** — *The Lekki Headmaster* summaries, character analysis, predicted questions
- **Admin Panel** — question import (CSV/JSON), publish workflow, analytics dashboard

## Deployment

Deployed on [Vercel](https://vercel.com). Set all environment variables in the Vercel project settings before deploying.
