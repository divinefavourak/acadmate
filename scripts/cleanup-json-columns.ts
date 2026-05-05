/**
 * Phase 4 cleanup script — run ONLY after:
 *   1. npx npm run db:backfill:verify shows 100% coverage
 *   2. Dual-write has been live for at least one full deployment cycle
 *   3. No active rollback window required
 *
 * This script removes the JSON columns from the results table.
 * It is intentionally a raw SQL script (not a Prisma migration) so it can be
 * reviewed, staged in a transaction, and rolled back independently.
 *
 * Usage:
 *   npx tsx scripts/cleanup-json-columns.ts --confirm
 */

import { PrismaClient } from "@prisma/client";

const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!datasourceUrl) throw new Error("Neither DIRECT_URL nor DATABASE_URL is set");

const prisma = new PrismaClient({
  log: ["error"],
  datasourceUrl,
});

const CONFIRMED = process.argv.includes("--confirm");

type CountRow = [{ count: bigint }];

async function verify() {
  // Correct check: results where the JSON array is non-empty BUT has no
  // corresponding normalized rows. Results with empty [] JSON are legitimately
  // "migrated" — there was simply nothing to insert.
  const [totalRow, subjectGapRow, topicGapRow, subjectRowCount, topicRowCount] =
    await Promise.all([
      prisma.$queryRaw<CountRow>`SELECT COUNT(*)::bigint AS count FROM results`,
      prisma.$queryRaw<CountRow>`
        SELECT COUNT(*)::bigint AS count FROM results r
        WHERE jsonb_array_length(r."subjectBreakdown") > 0
          AND NOT EXISTS (
            SELECT 1 FROM result_subject_breakdowns rsb WHERE rsb."resultId" = r.id
          )
      `,
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

  return {
    totalResults: Number(totalRow[0].count),
    subjectGap: Number(subjectGapRow[0].count),
    topicGap: Number(topicGapRow[0].count),
    subjectRows: Number(subjectRowCount[0].count),
    topicRows: Number(topicRowCount[0].count),
  };
}

async function main() {
  console.log("Checking migration coverage before cleanup...\n");

  const { totalResults, subjectGap, topicGap, subjectRows, topicRows } = await verify();

  console.log(`Total results                     : ${totalResults}`);
  console.log(`ResultSubjectBreakdown rows        : ${subjectRows}`);
  console.log(`ResultTopicBreakdown rows          : ${topicRows}`);
  console.log(`Non-empty subject JSON, no rows    : ${subjectGap} (must be 0)`);
  console.log(`Non-empty topic JSON, no rows      : ${topicGap} (must be 0)`);

  if (subjectGap > 0 || topicGap > 0) {
    console.error(
      `\n✗ Cannot proceed: ${subjectGap} subject gap(s), ${topicGap} topic gap(s).\n` +
      `Run: npm run db:backfill`
    );
    process.exit(1);
  }

  console.log("\n✓ All results are fully migrated.\n");

  if (!CONFIRMED) {
    console.log(
      "DRY RUN — pass --confirm to execute the column drop.\n\n" +
      "SQL that would be executed:\n\n" +
      "  ALTER TABLE results DROP COLUMN subject_breakdown;\n" +
      "  ALTER TABLE results DROP COLUMN topic_breakdown;\n"
    );
    return;
  }

  console.log("Dropping JSON columns from results table...");

  // Run both drops in a single transaction for atomicity
  await prisma.$executeRawUnsafe(`
    ALTER TABLE results
      DROP COLUMN IF EXISTS subject_breakdown,
      DROP COLUMN IF EXISTS topic_breakdown;
  `);

  console.log("✓ Columns dropped successfully.");
  console.log("\nNext steps:");
  console.log("  1. Remove subjectBreakdown and topicBreakdown from prisma/schema.prisma");
  console.log("  2. Run: npx prisma generate");
  console.log("  3. Remove JSON fallback code from app/api/analytics/route.ts");
  console.log("  4. Remove JSON selects from app/api/results/[id]/route.ts");
  console.log("  5. Remove Prisma.InputJsonValue casts from app/api/exams/[id]/submit/route.ts");
  console.log("  6. Run: npx tsc --noEmit to confirm no remaining references");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
