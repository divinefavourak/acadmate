import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminSubjectsService } from './admin-subjects.service';

class CreateSubjectDto {
  @IsString() name: string;
  @IsString() code: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

class CreateTopicDto {
  @IsString() subjectId: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminSubjectsController {
  constructor(private readonly adminSubjectsService: AdminSubjectsService) {}

  // ─── Subjects ──────────────────────────────────────────────────────────────
  @Get('subjects') listSubjects() { return this.adminSubjectsService.listSubjects(); }

  @Post('subjects') @HttpCode(HttpStatus.CREATED)
  createSubject(@Body() dto: CreateSubjectDto) { return this.adminSubjectsService.createSubject(dto); }

  @Patch('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() dto: Partial<CreateSubjectDto>) {
    return this.adminSubjectsService.updateSubject(id, dto);
  }

  @Delete('subjects/:id') @HttpCode(HttpStatus.OK)
  deleteSubject(@Param('id') id: string) { return this.adminSubjectsService.deleteSubject(id); }

  // ─── Topics ────────────────────────────────────────────────────────────────
  @Get('topics')
  listTopics(@Query('subjectId') subjectId?: string) {
    return this.adminSubjectsService.listTopics(subjectId);
  }

  @Post('topics') @HttpCode(HttpStatus.CREATED)
  createTopic(@Body() dto: CreateTopicDto) { return this.adminSubjectsService.createTopic(dto); }

  @Patch('topics/:id')
  updateTopic(@Param('id') id: string, @Body() dto: Partial<Omit<CreateTopicDto, 'subjectId'>>) {
    return this.adminSubjectsService.updateTopic(id, dto);
  }

  @Delete('topics/:id') @HttpCode(HttpStatus.OK)
  deleteTopic(@Param('id') id: string) { return this.adminSubjectsService.deleteTopic(id); }
}
