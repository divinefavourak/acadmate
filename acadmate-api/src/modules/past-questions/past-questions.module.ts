import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PastQuestionExplanationsController, PastQuestionsController } from './past-questions.controller';
import { PastQuestionsService } from './past-questions.service';

@Module({
  imports: [AuthModule],
  controllers: [PastQuestionsController, PastQuestionExplanationsController],
  providers: [PastQuestionsService],
  exports: [PastQuestionsService],
})
export class PastQuestionsModule {}
