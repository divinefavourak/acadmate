import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsInt, IsOptional, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BlogCategory } from '@prisma/client';
import { BlogService } from './blog.service';

const ALLOWED_CATEGORIES: BlogCategory[] = [
  'UTME',
  'POST_UTME',
  'JAMB',
  'SCHOOL_NEWS',
  'STUDY_TIPS',
  'SCHOLARSHIPS',
  'CAREER',
  'ANNOUNCEMENT',
  'GENERAL',
];

class ListBlogQuery {
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit?: number = 12;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
  @IsOptional() @IsIn(ALLOWED_CATEGORIES) category?: BlogCategory;
}

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @ApiOperation({ summary: 'List published blog posts (public)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'category', required: false, enum: ALLOWED_CATEGORIES })
  list(@Query() query: ListBlogQuery) {
    return this.blogService.listPublic({
      limit: query.limit ?? 12,
      offset: query.offset ?? 0,
      category: query.category,
    });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published blog post by slug (public)' })
  getBySlug(@Param('slug') slug: string) {
    return this.blogService.getPublicBySlug(slug);
  }
}
