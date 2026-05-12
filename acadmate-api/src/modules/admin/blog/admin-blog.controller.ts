import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsIn, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { BlogCategory } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { BlogService } from '../../blog/blog.service';

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
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

class CreateBlogPostDto {
  @IsString() @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(96) slug?: string;
  @IsString() @MaxLength(500) excerpt!: string;
  @IsString() body!: string;
  @IsOptional() @IsString() coverImageUrl?: string | null;
  @IsIn(ALLOWED_CATEGORIES) category!: BlogCategory;
}

class UpdateBlogPostDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(96) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() coverImageUrl?: string | null;
  @IsOptional() @IsIn(ALLOWED_CATEGORIES) category?: BlogCategory;
}

@ApiTags('admin-blog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/blog')
export class AdminBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @ApiOperation({ summary: 'List all blog posts (admin)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  list(@Query() query: ListBlogQuery) {
    return this.blogService.listAdmin({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blog post by ID (admin)' })
  getById(@Param('id') id: string) {
    return this.blogService.getAdminById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a blog post (draft until published)' })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBlogPostDto) {
    return this.blogService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a blog post' })
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blogService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a blog post' })
  delete(@Param('id') id: string) {
    return this.blogService.delete(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a post — emails all Premium users on first publish' })
  publish(@Param('id') id: string) {
    return this.blogService.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish a post (hides from public; does not resend email)' })
  unpublish(@Param('id') id: string) {
    return this.blogService.unpublish(id);
  }
}
