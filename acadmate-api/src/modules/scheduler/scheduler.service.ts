import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExamExpiryService } from '../exams/exam-expiry.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly examExpiry: ExamExpiryService) {}

  /**
   * Runs every minute. Marks all IN_PROGRESS sessions past their deadline
   * as TIMED_OUT. This is the bulk expiry sweep that was referenced in the
   * existing lib/services/exam-expiry.ts but never wired to a cron job.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleExamSessions() {
    const count = await this.examExpiry.expireStaleSessions();
    if (count > 0) {
      this.logger.log(`Expired ${count} stale exam session(s)`);
    }
  }
}
