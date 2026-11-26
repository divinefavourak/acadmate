import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from '../settings/settings.service';
import { ReferralContestService } from './referral-contest.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

class UpdateContestDto {
  // null clears a date, which switches the contest off.
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(DATE, { message: 'start must look like 2026-12-09' }) start?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(DATE, { message: 'end must look like 2026-12-31' }) end?: string | null;
  @IsOptional() @IsString() @MaxLength(200) prize?: string;
}

class ExcludeDto {
  @IsString() userId!: string;
  @IsBoolean() excluded!: boolean;
}

@ApiTags('referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralContestController {
  constructor(private readonly contest: ReferralContestService) {}

  @Get('contest')
  @ApiOperation({ summary: 'Referral contest: dates, prize, top 20 and your place' })
  get(@CurrentUser() user: JwtUser) {
    return this.contest.forStudent(user.id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/referrals/contest')
export class AdminReferralContestController {
  constructor(
    private readonly contest: ReferralContestService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Contest board with each referrer’s friends, for checking before paying' })
  get() {
    return this.contest.forAdmin();
  }

  @Patch()
  @ApiOperation({ summary: 'Set the contest dates and prize (null dates switch it off)' })
  update(@Body() dto: UpdateContestDto) {
    return this.settings.setReferralContest(dto);
  }

  @Post('exclude')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disqualify a referrer from the contest, or put them back' })
  exclude(@Body() dto: ExcludeDto) {
    return this.contest.setExcluded(dto.userId, dto.excluded);
  }
}
