import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { FlagsService } from './flags.service';

@ApiTags('flags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flags')
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  @Get()
  @ApiOperation({ summary: "Get current user's flagged questions" })
  getMyFlags(@CurrentUser() user: JwtUser) {
    return this.flagsService.getMyFlags(user.id);
  }
}
