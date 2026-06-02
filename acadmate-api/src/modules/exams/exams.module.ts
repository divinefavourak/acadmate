import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamFactoryService } from './exam-factory.service';
import { ExamExpiryService } from './exam-expiry.service';
import { ScoringService } from './scoring.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [ExamsController],
  providers: [ExamsService, ExamFactoryService, ExamExpiryService, ScoringService],
  exports: [ExamExpiryService, ScoringService, ExamFactoryService],
})
export class ExamsModule {}
