import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { LiveSessionsService } from './live-sessions.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { UpdateLiveSessionStatusDto } from './dto/update-status.dto';

@ApiTags('live-sessions')
@Controller('live-sessions')
export class LiveSessionsController {
  constructor(private readonly liveSessions: LiveSessionsService) {}

  // ─── Admin ────────────────────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a live session and generate a join code' })
  create(@CurrentUser() admin: JwtUser, @Body() dto: CreateLiveSessionDto) {
    return this.liveSessions.create(admin.id, dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List live sessions created by the admin' })
  list(@CurrentUser() admin: JwtUser) {
    return this.liveSessions.list(admin.id);
  }

  @Patch(':code/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move a live session to ACTIVE / ENDED' })
  updateStatus(
    @CurrentUser() admin: JwtUser,
    @Param('code') code: string,
    @Body() dto: UpdateLiveSessionStatusDto,
  ) {
    return this.liveSessions.updateStatus(admin.id, code, dto.status);
  }

  @Delete(':code')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a stale (scheduled/ended) live session' })
  remove(@CurrentUser() admin: JwtUser, @Param('code') code: string) {
    return this.liveSessions.remove(admin.id, code);
  }

  @Get(':code/results')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Live leaderboard / participant board (polled)' })
  results(@CurrentUser() admin: JwtUser, @Param('code') code: string) {
    return this.liveSessions.getResults(admin.id, code);
  }

  // ─── Public (student join page) ────────────────────────────────────────────
  @Get(':code')
  @ApiOperation({ summary: 'Public join-page info for a live session' })
  getPublic(@Param('code') code: string) {
    return this.liveSessions.getPublic(code);
  }

  // ─── Student ────────────────────────────────────────────────────────────────
  @Post(':code/join')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Join a live session — forks the student an exam' })
  join(@CurrentUser() user: JwtUser, @Param('code') code: string) {
    return this.liveSessions.join(user.id, code);
  }
}
