import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PastQuestionsService } from './past-questions.service';

class PageQuery {
  @IsOptional() @IsInt() @Min(1) @Max(1000) @Type(() => Number) page?: number;
}

class SitemapQuery {
  @IsOptional() @IsInt() @Min(0) @Max(1000) @Type(() => Number) page?: number;
}

const SLUG_RE = /^[a-z0-9-]{1,200}$/;

function checkSlug(value: string): string {
  if (!SLUG_RE.test(value)) throw new NotFoundException();
  return value;
}

/**
 * Public, read-only and Redis-cached. The Next.js site renders these pages
 * from a handful of shared Vercel IPs, so a search-engine crawl can burst well
 * past the global 100/min per-IP limit; allow more here.
 */
@ApiTags('public')
@Throttle({ default: { limit: 1000, ttl: 60_000 } })
@Controller('public/past-questions')
export class PastQuestionsController {
  constructor(private readonly service: PastQuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'Subjects and years with public JAMB past questions' })
  hub() {
    return this.service.getHub();
  }

  @Get('sitemap')
  @ApiOperation({ summary: 'Question slugs for the sitemap, 5,000 per page' })
  @ApiQuery({ name: 'page', required: false })
  sitemap(@Query() query: SitemapQuery) {
    return this.service.getSitemapPage(query.page ?? 0);
  }

  @Get('questions/:slug')
  @ApiOperation({ summary: 'One public past question with answer, explanation and related questions' })
  question(@Param('slug') slug: string) {
    return this.service.getQuestion(checkSlug(slug));
  }

  @Get('jamb/:subject')
  @ApiOperation({ summary: 'Years and topics for one subject' })
  subject(@Param('subject') subject: string) {
    return this.service.getSubject(checkSlug(subject));
  }

  @Get('jamb/:subject/:year')
  @ApiOperation({ summary: 'One year of a subject, 20 questions per page, answers included' })
  @ApiQuery({ name: 'page', required: false })
  year(
    @Param('subject') subject: string,
    @Param('year', ParseIntPipe) year: number,
    @Query() query: PageQuery,
  ) {
    return this.service.getYear(checkSlug(subject), year, query.page ?? 1);
  }
}

/**
 * Signed-in only. Worked explanations are kept off the public (cached, crawled)
 * pages; the browser fetches one when a signed-in student opens a solution.
 * The global 100/min per-IP limit applies.
 */
@ApiTags('past-questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('past-questions')
export class PastQuestionExplanationsController {
  constructor(private readonly service: PastQuestionsService) {}

  @Get('questions/:slug/explanation')
  @ApiOperation({ summary: 'Worked explanation for one public past question (signed-in users)' })
  explanation(@Param('slug') slug: string) {
    return this.service.getExplanation(checkSlug(slug));
  }
}
