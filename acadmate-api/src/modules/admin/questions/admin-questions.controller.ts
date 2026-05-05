import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Difficulty } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { AdminQuestionsService } from './admin-questions.service';

class AdminQuestionQueryDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() topicId?: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
  @IsOptional() @IsInt() @Type(() => Number) year?: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() flagged?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() isPublished?: boolean;
}

class PublishDto {
  @IsBoolean() isPublished: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(private readonly adminQuestionsService: AdminQuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'List questions with admin filters' })
  listQuestions(@Query() query: AdminQuestionQueryDto) {
    return this.adminQuestionsService.listQuestions(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question detail (admin)' })
  getQuestion(@Param('id') id: string) {
    return this.adminQuestionsService.getQuestion(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a question' })
  createQuestion(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.adminQuestionsService.createQuestion(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a question' })
  updateQuestion(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: any) {
    return this.adminQuestionsService.updateQuestion(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a question' })
  deleteQuestion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.adminQuestionsService.deleteQuestion(user.id, id);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Toggle publish status' })
  togglePublish(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: PublishDto) {
    return this.adminQuestionsService.togglePublish(user.id, id, dto.isPublished);
  }

  @Patch(':id/resolve-flag')
  @ApiOperation({ summary: 'Resolve all flags on a question' })
  resolveFlag(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.adminQuestionsService.resolveFlag(user.id, id);
  }
}
