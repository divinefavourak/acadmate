import {
  Controller, Get, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ResultsService } from './results.service';

class PaginationQuery {
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@ApiTags('results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated result history' })
  listResults(@CurrentUser() user: JwtUser, @Query() query: PaginationQuery) {
    return this.resultsService.listResults(user.id, query.limit ?? 20, query.offset ?? 0);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detailed result with subject/topic breakdowns' })
  getResult(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.resultsService.getResult(user.id, id);
  }
}
