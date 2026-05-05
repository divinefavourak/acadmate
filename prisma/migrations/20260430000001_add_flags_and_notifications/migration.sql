-- Migration: add_flags_and_notifications
-- Applied directly to database outside of Prisma migration workflow.
-- This file records those changes in migration history.
-- DO NOT re-run: these changes already exist in the production database.

-- ─── AlterTable: questions ────────────────────────────────────────────────────

ALTER TABLE "questions" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "questions" ADD COLUMN "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "questions" ADD COLUMN "flagCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "questions_isFlagged_idx" ON "questions"("isFlagged");
CREATE INDEX "questions_year_idx" ON "questions"("year");
CREATE INDEX "questions_subjectId_year_idx" ON "questions"("subjectId", "year");
CREATE INDEX "questions_subjectId_year_isPublished_idx" ON "questions"("subjectId", "year", "isPublished");

-- ─── CreateTable: question_flags ─────────────────────────────────────────────

CREATE TABLE "question_flags" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_flags_userId_idx" ON "question_flags"("userId");
CREATE INDEX "question_flags_questionId_idx" ON "question_flags"("questionId");
CREATE UNIQUE INDEX "question_flags_questionId_userId_key" ON "question_flags"("questionId", "userId");

-- AddForeignKey
ALTER TABLE "question_flags" ADD CONSTRAINT "question_flags_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_flags" ADD CONSTRAINT "question_flags_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CreateTable: admin_notifications ────────────────────────────────────────

CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "questionId" TEXT,
    "triggeredById" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_notifications_read_idx" ON "admin_notifications"("read");
CREATE INDEX "admin_notifications_createdAt_idx" ON "admin_notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_triggeredById_fkey"
    FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
