import {
  Controller, Post, Get, Body, Query, Param, UseGuards, HttpCode, HttpStatus,
  BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { PrismaService } from '../../../prisma/prisma.service';

class ProcessImportDto {
  @IsString() filename: string;
  @IsArray() rows: unknown[];
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

    const result = await this.importService.processImport({
      adminId: user.id,
      filename: dto.filename,
      rows: dto.rows,
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

    return { imports, total, limit, offset };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish all valid questions from an import' })
  async publishImport(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const importRecord = await this.prisma.import.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!importRecord) throw new NotFoundException('Import not found');
    if (importRecord.status !== 'DONE') {
      throw new ConflictException('Import must be in DONE status before publishing');
    }

    const result = await this.prisma.question.updateMany({
      where: { importId: id, isPublished: false },
      data: { isPublished: true, reviewedAt: new Date(), reviewedById: user.id },
    });

    await this.prisma.import.update({
      where: { id },
      data: { publishedRows: result.count },
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
