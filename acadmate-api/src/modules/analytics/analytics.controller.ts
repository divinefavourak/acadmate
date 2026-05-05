import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

class AnalyticsQuery {
  @IsOptional() @IsInt() @Min(10) @Max(200) @Type(() => Number) limit?: number = 100;
}

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Student performance analytics dashboard' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results to analyse (10–200, default 100)' })
  getAnalytics(@CurrentUser() user: JwtUser, @Query() query: AnalyticsQuery) {
    return this.analyticsService.getStudentAnalytics(user.id, query.limit ?? 100);
  }
}
