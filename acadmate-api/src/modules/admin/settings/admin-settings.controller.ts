import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SettingsService } from '../../settings/settings.service';

class UpdateExamAvailabilityDto {
  @IsOptional() @IsBoolean() utme?: boolean;
  @IsOptional() @IsBoolean() postUtme?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings/exam-availability')
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current exam-group availability' })
  get() {
    return this.settingsService.getExamAvailability();
  }

  @Patch()
  @ApiOperation({ summary: 'Turn exam groups on or off for students' })
  update(@Body() dto: UpdateExamAvailabilityDto) {
    return this.settingsService.setExamAvailability(dto);
  }
}
