import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExamExpiryService } from '../exams/exam-expiry.service';
import { PastQuestionsService } from '../past-questions/past-questions.service';
import { EngagementService } from '../engagement/engagement.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly examExpiry: ExamExpiryService,
    private readonly pastQuestions: PastQuestionsService,
    private readonly engagement: EngagementService,
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

  /**
   * Practice reminders: one random batch a day at 10:00 Lagos time, when
   * students are likely to read it. Batch size and on/off are in app_settings
   * (Admin, Settings), so this needs no deploy to tune or pause.
   */
  @Cron('0 10 * * *', { name: 'practiceReminders', timeZone: 'Africa/Lagos' })
  async sendPracticeReminders() {
    try {
      await this.engagement.sendReminderBatch();
    } catch (err) {
      this.logger.error('sendPracticeReminders cron failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
