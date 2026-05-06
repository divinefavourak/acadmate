import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExamExpiryService } from '../exams/exam-expiry.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly examExpiry: ExamExpiryService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleExamSessions() {
    try {
      const count = await this.examExpiry.expireStaleSessions();
      this.logger.debug(
        JSON.stringify({ job: 'expireStaleExamSessions', expiredCount: count, timestamp: new Date().toISOString() }),
      );
      if (count > 0) {
        this.logger.log(`Expired ${count} stale exam session(s)`);
      }
    } catch (err) {
      this.logger.error(
        'expireStaleExamSessions cron failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
