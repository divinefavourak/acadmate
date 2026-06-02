import { Module } from '@nestjs/common';
import { LiveSessionsController } from './live-sessions.controller';
import { LiveSessionsService } from './live-sessions.service';
import { ExamsModule } from '../exams/exams.module';

@Module({
  imports: [ExamsModule],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService],
})
export class LiveSessionsModule {}
