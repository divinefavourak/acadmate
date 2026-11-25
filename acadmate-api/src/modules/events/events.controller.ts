import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { CLIENT_EVENTS, ClientEvent, EventsService } from './events.service';

class TrackDto {
  @IsIn(CLIENT_EVENTS as unknown as string[]) name!: ClientEvent;
  @IsOptional() @IsObject() props?: Record<string, unknown>;
}

class FunnelQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number = 30;
}

/** Keep client props small and flat: short strings, numbers, booleans. */
function cleanProps(props: Record<string, unknown> | undefined) {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props).slice(0, 8)) {
    if (!/^[a-zA-Z_]{1,32}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 64);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Record a funnel event from the browser (allow-listed names only)' })
  track(@CurrentUser() user: JwtUser, @Body() dto: TrackDto) {
    this.events.record(dto.name, user.id, cleanProps(dto.props));
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/funnel')
export class AdminFunnelController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Funnel steps (distinct students) and daily event counts' })
  report(@Query() query: FunnelQuery) {
    return this.events.report(query.days ?? 30);
  }
}
