import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET — latest 30 + unread count (port of /api/admin/notifications GET)
  async getNotifications() {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
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
      this.prisma.adminNotification.count({ where: { read: false } }),
    ]);

    return { notifications, unreadCount };
  }

  // PATCH — mark all as read (port of /api/admin/notifications PATCH)
  async markAllRead() {
    await this.prisma.adminNotification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return { ok: true };
  }
}
