import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { DailyService } from './daily.service';

@ApiTags('daily')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  @Get()
  @ApiOperation({ summary: "Today's challenge (new, in progress or done) and the student's streak" })
  status(@CurrentUser() user: JwtUser) {
    return this.daily.status(user.id);
  }

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Start (or resume) today's challenge; returns the exam session id" })
  start(@CurrentUser() user: JwtUser) {
    return this.daily.start(user.id);
  }
}
