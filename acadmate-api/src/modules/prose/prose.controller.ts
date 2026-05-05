import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProseService } from './prose.service';

@ApiTags('prose')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prose')
export class ProseController {
  constructor(private readonly proseService: ProseService) {}

  @Get()
  @ApiOperation({ summary: 'List published prose texts' })
  listProse() {
    return this.proseService.listProse();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prose text with all sections' })
  getProse(@Param('id') id: string) {
    return this.proseService.getProseById(id);
  }
}
