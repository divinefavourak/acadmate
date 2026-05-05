import {
  Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { QuestionsService } from './questions.service';

class QuestionQueryDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() topicId?: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
  @IsOptional() @IsInt() @Min(1) @Max(500) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'Browse published questions with filters' })
  browse(@Query() query: QuestionQueryDto) {
    return this.questionsService.browseQuestions(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question detail with explanation' })
  getOne(@Param('id') id: string) {
    return this.questionsService.getQuestion(id);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flag a question as incorrect / problematic' })
  flag(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.questionsService.flagQuestion(user.id, id);
  }
}
