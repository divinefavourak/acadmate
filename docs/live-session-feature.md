# Live Session Feature Design

Admin creates a timed mock practice session, shares a link with students, monitors results in real-time.

---

## The Core Idea

Admin creates a *Live Session* — a named, configured exam (subjects, duration, question count) — gets a short join code, shares the link. Students click it, take a normal exam, and results aggregate on the admin's dashboard as they submit.

---

## New DB Model — `LiveSession`

```prisma
model LiveSession {
  id              String            @id @default(cuid())
  code            String            @unique  // short code e.g. "ABC-4X9"
  title           String?
  status          LiveSessionStatus @default(SCHEDULED)
  mode            ExamMode
  subjectIds      String[]
  durationMinutes Int               @default(60)
  questionCount   Int               @default(40)
  createdById     String
  endsAt          DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  createdBy    User          @relation(...)
  examSessions ExamSession[]
}

enum LiveSessionStatus {
  SCHEDULED
  ACTIVE
  ENDED
}
```

Add `liveSessionId?` (optional FK) on the existing `ExamSession` model — the only change to existing models.

---

## Backend (NestJS) — new `live-sessions` module

| Endpoint | Who | Purpose |
|---|---|---|
| `POST /live-sessions` | admin | Create session, generate short code |
| `PATCH /live-sessions/:code/status` | admin | Move to ACTIVE / ENDED |
| `GET /live-sessions/:code` | public | Student join page info |
| `POST /live-sessions/:code/join` | student | Creates their `ExamSession` linked to the live session |
| `GET /live-sessions/:code/results` | admin | Leaderboard (polled every ~10s) |

---

## Frontend Pages

| Route | Who | Purpose |
|---|---|---|
| `/admin/live` | admin | Create new sessions + list existing |
| `/admin/live/[code]` | admin | Dashboard: who joined, in-progress (% answered, time left), submitted (score) |
| `/live/[code]` | student | Landing: "You're joining [Title] session. Ready to start?" |

---

## Real-time Strategy: Polling (not WebSocket)

Admin's dashboard polls `/live-sessions/:code/results` every **10 seconds**. Students never need live feedback from each other — their exam flow is fully self-contained. This avoids adding WebSocket infrastructure (sticky sessions, Redis pub/sub) with no user-visible benefit for a class of ~50 students submitting over 60 minutes.

---

## Key Design Decisions

- **Join-and-fork pattern**: `liveSessionId` on `ExamSession` is the only coupling. All existing exam logic (scoring, timer expiry, result storage) runs completely unchanged.
- **Short human-readable codes**: 6-character alphanumeric excluding ambiguous chars (0/O, 1/l/I) → ~1.5B combinations. Easy to read aloud or type from a whiteboard.
- **No new exam logic**: students take a normal exam; the live session is just a *configuration envelope* and attribution tag.
