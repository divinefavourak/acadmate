-- Migration: add_result_breakdown_tables
-- Normalizes the JSON subjectBreakdown / topicBreakdown fields on the results
-- table into dedicated relational tables for efficient analytics queries.
-- The JSON columns are kept on results until the backfill is verified complete.

-- ─── CreateTable: result_subject_breakdowns ───────────────────────────────────

CREATE TABLE "result_subject_breakdowns" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "result_subject_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "result_subject_breakdowns_resultId_subjectId_key"
    ON "result_subject_breakdowns"("resultId", "subjectId");
CREATE INDEX "result_subject_breakdowns_resultId_idx"
    ON "result_subject_breakdowns"("resultId");
CREATE INDEX "result_subject_breakdowns_subjectId_idx"
    ON "result_subject_breakdowns"("subjectId");

-- AddForeignKey
ALTER TABLE "result_subject_breakdowns" ADD CONSTRAINT "result_subject_breakdowns_resultId_fkey"
    FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CreateTable: result_topic_breakdowns ─────────────────────────────────────

CREATE TABLE "result_topic_breakdowns" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "result_topic_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "result_topic_breakdowns_resultId_topicId_key"
    ON "result_topic_breakdowns"("resultId", "topicId");
CREATE INDEX "result_topic_breakdowns_resultId_idx"
    ON "result_topic_breakdowns"("resultId");
CREATE INDEX "result_topic_breakdowns_topicId_idx"
    ON "result_topic_breakdowns"("topicId");

-- AddForeignKey
ALTER TABLE "result_topic_breakdowns" ADD CONSTRAINT "result_topic_breakdowns_resultId_fkey"
    FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
