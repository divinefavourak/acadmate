import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id: subjectId } = await params;
    
    // Group questions by year for this subject
    const yearGroups = await prisma.question.groupBy({
      by: ["year"],
      where: { subjectId },
      _count: { _all: true },
      orderBy: { year: "desc" },
    });

    const years = yearGroups.map((g) => ({
      year: g.year,
      count: g._count._all,
    }));

    return NextResponse.json({ years });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
