import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';

// Read-only, student-facing view of platform settings. The exam picker uses
// this to grey out exam groups the admin has switched off.
@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('exam-availability')
  @ApiOperation({ summary: 'Which exam groups are currently open to students' })
  getExamAvailability() {
    return this.settingsService.getExamAvailability();
  }
}
