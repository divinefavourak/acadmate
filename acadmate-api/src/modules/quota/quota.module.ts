import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { SettingsModule } from '../settings/settings.module';

// Shared by ExamsModule (enforcement) and UsersModule (GET /users/me/quota).
@Module({
  imports: [SettingsModule],
  providers: [QuotaService],
  exports: [QuotaService],
})
export class QuotaModule {}
