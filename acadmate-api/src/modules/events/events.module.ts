import { Global, Module } from '@nestjs/common';
import { AdminFunnelController, EventsController } from './events.controller';
import { EventsService } from './events.service';

// Global: signup, exams, daily, tokens and users all record events.
@Global()
@Module({
  controllers: [EventsController, AdminFunnelController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
