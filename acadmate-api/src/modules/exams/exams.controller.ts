import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { MarkReviewDto } from './dto/mark-review.dto';

class PaginationQuery {
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@ApiTags('exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new exam session (MOCK / PRACTICE / TOPIC)' })
  createSession(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateExamDto,
  ) {
    return this.examsService.createSession(user.id, dto as any);
  }

  @Get()
  @ApiOperation({ summary: 'List user exam sessions' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  listSessions(@CurrentUser() user: JwtUser, @Query() query: PaginationQuery) {
    return this.examsService.listSessions(user.id, query.limit ?? 20, query.offset ?? 0);
  }

  @Get('active')
  @ApiOperation({ summary: 'List in-progress (resumable) exam sessions' })
  listActiveSessions(@CurrentUser() user: JwtUser) {
    return this.examsService.listActiveSessions(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam session state (questions, answers, timer)' })
  getSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.examsService.getSession(user.id, id);
  }

  @Post(':id/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk save / auto-save answers' })
  saveAnswers(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveAnswersDto,
  ) {
    return this.examsService.saveAnswers(user.id, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit exam and generate result' })
  submitExam(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.examsService.submitExam(user.id, id);
  }

  @Patch(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle mark-for-review on a question' })
  toggleReview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MarkReviewDto,
  ) {
    return this.examsService.toggleReview(user.id, id, dto);
  }
}
