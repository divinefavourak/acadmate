import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";
import { createSubjectSchema } from "@/lib/validation/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        sortOrder: true,
        _count: { select: { questions: true, topics: true } },
      },
    });
    return NextResponse.json({ subjects }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createSubjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const subject = await prisma.subject.create({ data: parsed.data });
    return NextResponse.json({ subject }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
