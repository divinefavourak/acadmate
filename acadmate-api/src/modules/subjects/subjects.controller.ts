import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubjectsService } from './subjects.service';

@ApiTags('subjects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List active subjects' })
  listSubjects() {
    return this.subjectsService.listSubjects();
  }

  @Get(':id/topics')
  @ApiOperation({ summary: 'List topics for a subject' })
  getTopics(@Param('id') id: string) {
    return this.subjectsService.getTopics(id);
  }
}
