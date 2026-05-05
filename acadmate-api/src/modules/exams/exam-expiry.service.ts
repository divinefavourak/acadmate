import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ExpiryCheckResult = { expired: false } | { expired: true };

@Injectable()
export class ExamExpiryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks a single session and marks it TIMED_OUT if past its deadline.
   * Called inline from route handlers when a student re-opens a session.
   */
  async resolveExamExpiry(
    sessionId: string,
    status: string,
    expiresAt: Date | null,
  ): Promise<ExpiryCheckResult> {
    if (status !== 'IN_PROGRESS' || !expiresAt || new Date() <= expiresAt) {
      return { expired: false };
    }

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { status: 'TIMED_OUT', submittedAt: new Date() },
    });

    return { expired: true };
  }

  /**
   * Bulk-expires all sessions that are still IN_PROGRESS but past their deadline.
   * Called every minute by the cron scheduler.
   * Returns count of expired sessions.
   */
  async expireStaleSessions(): Promise<number> {
    const { count } = await this.prisma.examSession.updateMany({
      where: {
        status: 'IN_PROGRESS',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'TIMED_OUT', submittedAt: new Date() },
    });

    return count;
  }
}
