import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { StudyService } from './study.service';

class SearchQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

@ApiTags('study')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get('subjects')
  @ApiOperation({ summary: 'Subjects with the student\'s reading progress' })
  listSubjects(@CurrentUser() user: JwtUser) {
    return this.studyService.listSubjects(user.id);
  }

  @Get('subjects/:id')
  @ApiOperation({ summary: 'Ordered topics of a subject with progress and lock state' })
  getSubject(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.studyService.getSubject(user.id, id);
  }

  @Get('continue')
  @ApiOperation({ summary: 'The unfinished topic the student read most recently' })
  getContinue(@CurrentUser() user: JwtUser) {
    return this.studyService.getContinue(user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search topics that have notes' })
  search(@Query() query: SearchQuery) {
    return this.studyService.search(query.q ?? '');
  }

  @Get('topics/:id')
  @ApiOperation({ summary: 'A topic\'s notes (preview only when locked)' })
  getTopic(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.studyService.getTopic(user.id, id);
  }

  @Post('notes/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a section as read' })
  markRead(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.studyService.markRead(user.id, id);
  }
}
