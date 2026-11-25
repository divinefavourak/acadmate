import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ExamsModule } from '../exams/exams.module';
import { PastQuestionsModule } from '../past-questions/past-questions.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [ExamsModule, PastQuestionsModule, EngagementModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
