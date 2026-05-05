import {
  Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus, BadRequestException,
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

    await this.prisma.adminActivityLog.create({
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
    });

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
}
