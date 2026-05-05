import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ExamsModule } from '../exams/exams.module';

@Module({
  imports: [ExamsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
