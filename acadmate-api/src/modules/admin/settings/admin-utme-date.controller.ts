import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, Matches, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SettingsService } from '../../settings/settings.service';

class UpdateUtmeDateDto {
  // null hides the dashboard countdown.
  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must look like 2027-04-15' })
  date?: string | null;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings/utme-date')
export class AdminUtmeDateController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the UTME start date used by the countdown' })
  get() {
    return this.settingsService.getUtmeDate();
  }

  @Patch()
  @ApiOperation({ summary: 'Set or clear the UTME start date' })
  update(@Body() dto: UpdateUtmeDateDto) {
    return this.settingsService.setUtmeDate(dto.date ?? null);
  }
}
