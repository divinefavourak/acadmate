import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ExamsModule } from '../exams/exams.module';
import { PastQuestionsModule } from '../past-questions/past-questions.module';

@Module({
  imports: [ExamsModule, PastQuestionsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
