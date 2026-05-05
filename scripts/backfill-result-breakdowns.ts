/**
 * Backfill script: ResultSubjectBreakdown + ResultTopicBreakdown
 *
 * Reads every existing Result row, parses its JSON breakdown fields, and writes
 * the data into the new normalized tables.
 *
 * Safety guarantees:
 *   - IDEMPOTENT: uses createMany({ skipDuplicates: true }) + unique(resultId, subjectId/topicId)
 *   - BATCHED: cursor-based pagination — constant memory regardless of table size
 *   - NON-DESTRUCTIVE: never modifies or deletes existing rows
 *   - RESUMABLE: safe to kill and re-run; already-migrated rows are silently skipped
 *
 * Usage:
 *   npx tsx scripts/backfill-result-breakdowns.ts
 *   npx tsx scripts/backfill-result-breakdowns.ts --dry-run    (validate without writing)
 *   npx tsx scripts/backfill-result-breakdowns.ts --verify     (count rows, confirm completeness)
 */

import { PrismaClient } from "@prisma/client";

// Use the direct (non-pooled) URL so the script connects to the same database
// branch that Prisma migrations target. The pooler URL (DATABASE_URL) may
// resolve to a different Neon branch when branches are in use.
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!datasourceUrl) throw new Error("Neither DIRECT_URL nor DATABASE_URL is set");

const prisma = new PrismaClient({
  log: ["error", "warn"],
  datasourceUrl,
});

const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY_ONLY = process.argv.includes("--verify");

// ─── Types matching the JSON shape written by computeScore() ─────────────────

type SubjectBreakdownEntry = {
  subjectId: string;
  name: string;
  correct: number;
  total: number;
};

type TopicBreakdownEntry = {
  topicId: string;
  name: string;
  correct: number;
  total: number;
};

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidSubjectEntry(s: unknown): s is SubjectBreakdownEntry {
  if (!s || typeof s !== "object") return false;
  const e = s as Record<string, unknown>;
  return (
    typeof e.subjectId === "string" &&
    e.subjectId.length > 0 &&
    typeof e.name === "string" &&
    typeof e.correct === "number" &&
    typeof e.total === "number"
  );
}

function isValidTopicEntry(t: unknown): t is TopicBreakdownEntry {
  if (!t || typeof t !== "object") return false;
  const e = t as Record<string, unknown>;
  return (
    typeof e.topicId === "string" &&
    e.topicId.length > 0 &&
    typeof e.name === "string" &&
    typeof e.correct === "number" &&
    typeof e.total === "number"
  );
}

// ─── Verify mode: count and report coverage ───────────────────────────────────
// Uses raw SQL exclusively so it works through Neon's pooler connection and
// gracefully handles the case where breakdown tables don't exist yet.

type CountRow = [{ count: bigint }];

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `;
  return rows[0].exists;
}

async function verify() {
  const [subjectTableExists, topicTableExists] = await Promise.all([
    tableExists("result_subject_breakdowns"),
    tableExists("result_topic_breakdowns"),
  ]);

  if (!subjectTableExists || !topicTableExists) {
    console.log("\n── Migration Status ─────────────────────────────────────────");
    console.log("  ✗ Breakdown tables not found in database.");
    console.log("  Run: npx prisma migrate deploy");
    console.log("─────────────────────────────────────────────────────────────\n");
    return;
  }

  const [totalRow, subjectGapRow, topicGapRow, subjectCountRow, topicCountRow] =
    await Promise.all([
      prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM results`,
      // Results with non-empty subject JSON but no normalized rows (true gap)
      prisma.$queryRaw<CountRow>`
        SELECT COUNT(*)::bigint AS count FROM results r
        WHERE jsonb_array_length(r."subjectBreakdown") > 0
          AND NOT EXISTS (
            SELECT 1 FROM result_subject_breakdowns rsb WHERE rsb."resultId" = r.id
          )
      `,
      // Results with non-empty topic JSON but no normalized rows (true gap)
      prisma.$queryRaw<CountRow>`
        SELECT COUNT(*)::bigint AS count FROM results r
        WHERE jsonb_array_length(r."topicBreakdown") > 0
          AND NOT EXISTS (
            SELECT 1 FROM result_topic_breakdowns rtb WHERE rtb."resultId" = r.id
          )
      `,
      prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM result_subject_breakdowns`,
      prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM result_topic_breakdowns`,
    ]);

  const totalResults = Number(totalRow[0].count);
  const subjectGap = Number(subjectGapRow[0].count);
  const topicGap = Number(topicGapRow[0].count);
  const subjectRows = Number(subjectCountRow[0].count);
  const topicRows = Number(topicCountRow[0].count);

  console.log("\n── Migration Status ─────────────────────────────────────────");
  console.log(`  Total Result rows                 : ${totalResults}`);
  console.log(`  Total ResultSubjectBreakdown rows : ${subjectRows}`);
  console.log(`  Total ResultTopicBreakdown rows   : ${topicRows}`);
  console.log(`  Non-empty subject JSON, no rows   : ${subjectGap} (must be 0)`);
  console.log(`  Non-empty topic JSON, no rows     : ${topicGap} (must be 0)`);
  console.log("─────────────────────────────────────────────────────────────\n");

  if (subjectGap === 0 && topicGap === 0) {
    console.log("✓ Backfill complete. Safe to run cleanup.");
  } else {
    console.log(`⚠ ${subjectGap} subject gap(s), ${topicGap} topic gap(s). Re-run backfill.`);
  }
}

function pct(n: number, total: number): string {
  return total === 0 ? "100" : ((n / total) * 100).toFixed(1);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
// Migration is complete: JSON columns have been dropped from the results table.
// This script now only runs the verify() check for historical reference.

async function main() {
  console.log("Migration complete — JSON columns have been removed.");
  console.log("Running coverage check on normalized tables...");
  await verify();
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
