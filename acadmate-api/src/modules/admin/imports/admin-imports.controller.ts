import {
  Controller, Post, Get, Body, Query, Param, UseGuards, HttpCode, HttpStatus,
  BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsInt, IsOptional, Min, Max, IsEnum, IsBoolean } from 'class-validator';
import { ExamType } from '@prisma/client';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { AWAITING_RELEASE, publishDecision, releasedImportIds } from './publish-rule';
import { PrismaService } from '../../../prisma/prisma.service';

class ProcessImportDto {
  @IsString() filename: string;
  @IsArray() rows: unknown[];
  @IsOptional() @IsEnum(ExamType) examType?: ExamType;
  @IsOptional() @IsString() school?: string;
  @IsOptional() @IsBoolean() createMissingTopics?: boolean;
}

class PaginationQuery {
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/imports')
export class AdminImportsController {
  constructor(
    private readonly importService: ImportService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a bulk question import (JSON rows)' })
  async processImport(@CurrentUser() user: JwtUser, @Body() dto: ProcessImportDto) {
    if (!dto.filename || !Array.isArray(dto.rows) || dto.rows.length === 0) {
      throw new BadRequestException('filename and rows[] are required');
    }

    // No batch-level school check: rows may carry their own school. Row validation rejects any POST_UTME
    // row that has neither its own school nor a batch default.
    const result = await this.importService.processImport({
      adminId: user.id,
      filename: dto.filename,
      rows: dto.rows,
      examType: dto.examType,
      school: dto.school,
      createMissingTopics: dto.createMissingTopics,
    });

    this.prisma.adminActivityLog.create({
      data: {
        adminId: user.id,
        action: 'IMPORT_QUESTIONS',
        entityType: 'import',
        entityId: result.importId,
        details: {
          filename: dto.filename,
          totalRows: result.totalRows,
          created: result.created,
          errors: result.errors.length,
        },
      },
    }).catch(() => {});

    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List import jobs' })
  async listImports(@Query() query: PaginationQuery) {
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.offset ?? 0;

    const [imports, total] = await this.prisma.$transaction([
      this.prisma.import.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          format: true,
          status: true,
          totalRows: true,
          validRows: true,
          invalidRows: true,
          publishedRows: true,
          createdAt: true,
          uploadedBy: { select: { name: true, email: true } },
        },
      }),
      this.prisma.import.count(),
    ]);

    // Completion is judged against what Publish would actually release, not the validated row count (which
    // includes duplicates and skipped rows) and not questions that were unpublished on purpose.
    const counts = await this.prisma.question.groupBy({
      by: ['importId', 'isPublished', 'isFlagged'],
      where: { importId: { in: imports.map((i) => i.id) } },
      _count: { _all: true },
    });
    const released = await releasedImportIds(this.prisma, imports);
    const awaiting = await this.prisma.question.groupBy({
      by: ['importId'],
      where: { importId: { in: imports.filter((i) => !released.has(i.id)).map((i) => i.id) }, ...AWAITING_RELEASE },
      _count: { _all: true },
    });
    const awaitingById = new Map(awaiting.map((a) => [a.importId, a._count._all]));
    const tally = (id: string, pred: (c: (typeof counts)[number]) => boolean) =>
      counts.filter((c) => c.importId === id && pred(c)).reduce((s, c) => s + c._count._all, 0);

    return {
      imports: imports.map((imp) => ({
        ...imp,
        createdQuestions: tally(imp.id, () => true),
        publishedQuestions: tally(imp.id, (c) => c.isPublished),
        publishableQuestions: tally(imp.id, (c) => c.isPublished) + (awaitingById.get(imp.id) ?? 0),
        unpublishedQuestions: tally(imp.id, (c) => !c.isFlagged && !c.isPublished) - (awaitingById.get(imp.id) ?? 0),
        flaggedDrafts: tally(imp.id, (c) => c.isFlagged && !c.isPublished),
      })),
      total,
      limit,
      offset,
    };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'First release of an import: publish its undecided, unflagged drafts' })
  async publishImport(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const importRecord = await this.prisma.import.findUnique({
      where: { id },
      select: { id: true, status: true, publishedRows: true },
    });

    if (!importRecord) throw new NotFoundException('Import not found');
    if (importRecord.status !== 'DONE') {
      throw new ConflictException('Import must be in DONE status before publishing');
    }

    if ((await releasedImportIds(this.prisma, [importRecord])).has(id)) {
      throw new ConflictException(
        'This import was already published. Publish its remaining questions from the Questions page.',
      );
    }

    // Flagged drafts (missing figure, duplicate options, placeholder answer) stay unpublished until someone fixes
    // them in the Question Builder and publishes them individually.
    // One transaction: a non-zero publishedRows is what marks the import as released.
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.question.updateMany({
        where: { importId: id, ...AWAITING_RELEASE },
        data: publishDecision(user.id, true),
      });
      const publishedTotal = await tx.question.count({ where: { importId: id, isPublished: true } });
      await tx.import.update({ where: { id }, data: { publishedRows: publishedTotal } });
      return updated;
    });

    this.prisma.adminActivityLog.create({
      data: {
        adminId: user.id,
        action: 'PUBLISH_IMPORT',
        entityType: 'import',
        entityId: id,
        details: { publishedCount: result.count },
      },
    }).catch(() => {});

    return { published: result.count };
  }
}
