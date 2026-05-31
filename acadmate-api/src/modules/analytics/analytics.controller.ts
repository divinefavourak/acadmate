import { Controller, Get, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Student performance analytics dashboard' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results to analyse (10–200, default 100)' })
  getAnalytics(@CurrentUser() user: JwtUser, @Query() query: AnalyticsQuery) {
    return this.analyticsService.getStudentAnalytics(user.id, query.limit ?? 100);
  }

  @Post('visit')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a site visit for today (public, no auth)' })
  recordVisit() {
    return this.analyticsService.recordVisit();
  }
}
