import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExamExpiryService } from '../exams/exam-expiry.service';
import { PastQuestionsService } from '../past-questions/past-questions.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly examExpiry: ExamExpiryService,
    private readonly pastQuestions: PastQuestionsService,
  ) {}

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

  /** New imports and admin-created questions get their public page URL here. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async assignPastQuestionSlugs() {
    try {
      await this.pastQuestions.assignMissingSlugs();
    } catch (err) {
      this.logger.error(
        'assignPastQuestionSlugs cron failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
