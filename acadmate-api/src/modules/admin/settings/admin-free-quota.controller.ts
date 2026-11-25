import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SettingsService, MAX_FREE_PER_SUBJECT } from '../../settings/settings.service';

class UpdateFreeQuotaDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_FREE_PER_SUBJECT) perSubject?: number;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings/free-quota')
export class AdminFreeQuotaController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the free-plan question limit' })
  get() {
    return this.settingsService.getFreeQuota();
  }

  @Patch()
  @ApiOperation({ summary: 'Turn the free-plan question limit on or off, or change it' })
  update(@Body() dto: UpdateFreeQuotaDto) {
    return this.settingsService.setFreeQuota(dto);
  }
}
