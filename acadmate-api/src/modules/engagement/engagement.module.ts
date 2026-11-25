import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { EngagementService } from './engagement.service';
import { EngagementController } from './engagement.controller';

// Practice reminders and their unsubscribe endpoint. The welcome email lives in
// AuthService, since it fires at sign-up.
@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
