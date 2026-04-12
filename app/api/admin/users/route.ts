import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";

// GET /api/admin/users - List all users with basic stats
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
    const role = req.nextUrl.searchParams.get("role");

    const where = role ? { role: role as "STUDENT" | "ADMIN" } : {};

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { examSessions: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total, limit, offset });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
