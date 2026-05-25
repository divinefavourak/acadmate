import {
  Controller, Get, Post, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsInt, IsOptional, IsIn, IsString, IsNotEmpty, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BlogCategory } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ForumService } from './forum.service';

const FORUM_CATEGORIES: BlogCategory[] = [
  'GENERAL', 'UTME', 'POST_UTME', 'JAMB',
  'SCHOOL_NEWS', 'STUDY_TIPS', 'SCHOLARSHIPS',
];

class ListThreadsQuery {
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
  @IsOptional() @IsIn(FORUM_CATEGORIES) category?: BlogCategory;
}

class CreateThreadDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(10_000) body: string;
  @IsIn(FORUM_CATEGORIES) category: BlogCategory;
}

class CreateReplyDto {
  @IsString() @IsNotEmpty() @MaxLength(5_000) body: string;
}

@ApiTags('forum')
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get()
  @ApiOperation({ summary: 'List forum threads (public)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'category', required: false, enum: FORUM_CATEGORIES })
  listThreads(@Query() query: ListThreadsQuery) {
    return this.forumService.listThreads({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      category: query.category,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single forum thread with replies (public)' })
  getThread(@Param('id') id: string) {
    return this.forumService.getThread(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new forum thread (auth required)' })
  createThread(@CurrentUser() user: JwtUser, @Body() dto: CreateThreadDto) {
    return this.forumService.createThread(user.id, dto);
  }

  @Post(':id/replies')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reply to a forum thread (auth required)' })
  createReply(
    @CurrentUser() user: JwtUser,
    @Param('id') threadId: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.forumService.createReply(user.id, threadId, dto.body);
  }
}
