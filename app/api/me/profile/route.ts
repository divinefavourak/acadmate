import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  targetYear: z.number().int().min(2020).max(2035).optional(),
  courseChoice: z.string().optional(),
  institution: z.string().optional(),
});

// PATCH /api/me/profile — upsert student profile
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { name, ...profileFields } = parsed.data;
    const userId = session.user.id;

    // Update user name if provided
    if (name) {
      await prisma.user.update({ where: { id: userId }, data: { name } });
    }

    // Upsert student profile
    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId },
      create: { userId, ...profileFields },
      update: profileFields,
    });

    return NextResponse.json({ studentProfile });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
