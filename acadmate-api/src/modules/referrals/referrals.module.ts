import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AdminReferralContestController, ReferralContestController } from './referral-contest.controller';
import { ReferralContestService } from './referral-contest.service';

@Module({
  imports: [SettingsModule],
  controllers: [ReferralContestController, AdminReferralContestController],
  providers: [ReferralContestService],
})
export class ReferralsModule {}
