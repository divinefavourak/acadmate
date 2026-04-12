import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";
import { createProseTextSchema } from "@/lib/validation/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const texts = await prisma.proseText.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        author: true,
        year: true,
        isPublished: true,
        _count: { select: { sections: true, questions: true } },
      },
    });
    return NextResponse.json({ texts });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createProseTextSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const text = await prisma.proseText.create({ data: parsed.data });
    return NextResponse.json({ text }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
