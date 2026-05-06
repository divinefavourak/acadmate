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
  async listSubjects() {
    const subjects = await this.subjectsService.listSubjects();
    return { subjects };
  }

  @Get(':id/topics')
  @ApiOperation({ summary: 'List topics for a subject' })
  async getTopics(@Param('id') id: string) {
    const topics = await this.subjectsService.getTopics(id);
    return { topics };
  }
}
