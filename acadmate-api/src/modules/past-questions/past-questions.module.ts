import { Module } from '@nestjs/common';
import { PastQuestionsController } from './past-questions.controller';
import { PastQuestionsService } from './past-questions.service';

@Module({
  controllers: [PastQuestionsController],
  providers: [PastQuestionsService],
  exports: [PastQuestionsService],
})
export class PastQuestionsModule {}
