import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PQ_TAG } from "@/lib/pastQuestions";

/**
 * Purges every cached past-question page and API response, including cached
 * 404s for papers that didn't exist yet. Call it after fixing or importing
 * questions:
 *
 *   curl -X POST https://www.acadmate.com.ng/api/revalidate \
 *     -H "Authorization: Bearer $REVALIDATE_SECRET"
 *
 * Pages re-render as they are next visited, which costs ISR writes the way a
 * fresh deploy does. Call it once after a batch of edits, not after each one.
 */
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "REVALIDATE_SECRET is not set" }, { status: 503 });
  }

  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Hashing first gives equal-length buffers, which timingSafeEqual requires.
  if (!timingSafeEqual(digest(given), digest(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The tag clears the Data Cache (fetch responses survive deploys). The paths
  // clear rendered pages, including ones that cached a notFound().
  revalidateTag(PQ_TAG, { expire: 0 });
  revalidatePath("/past-questions", "layout");
  revalidatePath("/question", "layout");

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
