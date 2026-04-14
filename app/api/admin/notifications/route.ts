import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/helpers";

// GET /api/admin/notifications — latest notifications + unread count
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          message: true,
          read: true,
          createdAt: true,
          questionId: true,
          triggeredBy: { select: { name: true, email: true } },
        },
      }),
      prisma.adminNotification.count({ where: { read: false } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/notifications — mark all as read
export async function PATCH() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    await prisma.adminNotification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
