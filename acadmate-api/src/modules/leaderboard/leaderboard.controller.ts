import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LeaderboardService, LeaderboardType } from './leaderboard.service';

class LeaderboardQuery {
  @IsOptional() @IsEnum(['UTME', 'POST_UTME']) type?: LeaderboardType = 'UTME';
  @IsOptional() @IsInt() @Min(5) @Max(100) @Type(() => Number) limit?: number = 50;
}

@ApiTags('leaderboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get leaderboard (UTME or POST_UTME)' })
  getLeaderboard(@Query() query: LeaderboardQuery) {
    return this.leaderboardService.getLeaderboard(query.type ?? 'UTME', query.limit ?? 50);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/leaderboard')
export class AdminLeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: get leaderboard (UTME or POST_UTME)' })
  getLeaderboard(@Query() query: LeaderboardQuery) {
    return this.leaderboardService.getLeaderboard(query.type ?? 'UTME', query.limit ?? 100);
  }
}
