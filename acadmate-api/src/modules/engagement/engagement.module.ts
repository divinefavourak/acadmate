import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { EngagementService } from './engagement.service';
import { EngagementController } from './engagement.controller';
import { EmailAssetsController } from './email-assets.controller';

// Fortnightly letters, their unsubscribe endpoint and the email logo. The
// welcome email lives in AuthService, since it fires at sign-up.
@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [EngagementController, EmailAssetsController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
