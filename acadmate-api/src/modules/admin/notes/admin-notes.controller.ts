import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { NotesAccess } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminNotesService } from './admin-notes.service';

const ACCESS: NotesAccess[] = ['FREE', 'PREMIUM'];

class OverviewQuery {
  @IsString() @IsNotEmpty() subjectId!: string;
}

class CreateNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @IsString() @IsNotEmpty() body!: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class UpdateNoteDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @IsNotEmpty() body?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class ReorderDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
}

class NotesSettingsDto {
  @IsOptional() @IsIn(ACCESS) notesAccess?: NotesAccess;
  // Publish (true) or unpublish (false) every section of the topic at once.
  @IsOptional() @IsBoolean() publishAll?: boolean;
}

class ImportNotesDto {
  // Items are validated row by row in the service so the admin gets a report.
  @IsArray() @ArrayMaxSize(2000) items!: unknown[];
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminNotesController {
  constructor(private readonly adminNotesService: AdminNotesService) {}

  @Get('notes/overview')
  @ApiOperation({ summary: 'Topics of a subject with their section counts' })
  overview(@Query() query: OverviewQuery) {
    return this.adminNotesService.overview(query.subjectId);
  }

  @Post('notes/import') @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk import note sections as drafts (supports dry run)' })
  importNotes(@Body() dto: ImportNotesDto) {
    return this.adminNotesService.importNotes(dto.items, dto.dryRun ?? false);
  }

  @Patch('notes/:id')
  updateNote(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.adminNotesService.updateNote(id, dto);
  }

  @Delete('notes/:id') @HttpCode(HttpStatus.OK)
  deleteNote(@Param('id') id: string) {
    return this.adminNotesService.deleteNote(id);
  }

  @Get('topics/:topicId/notes')
  listNotes(@Param('topicId') topicId: string) {
    return this.adminNotesService.listNotes(topicId);
  }

  @Post('topics/:topicId/notes') @HttpCode(HttpStatus.CREATED)
  createNote(@Param('topicId') topicId: string, @Body() dto: CreateNoteDto) {
    return this.adminNotesService.createNote(topicId, dto);
  }

  @Put('topics/:topicId/notes/order')
  reorder(@Param('topicId') topicId: string, @Body() dto: ReorderDto) {
    return this.adminNotesService.reorder(topicId, dto.ids);
  }

  @Patch('topics/:topicId/notes-settings')
  updateSettings(@Param('topicId') topicId: string, @Body() dto: NotesSettingsDto) {
    return this.adminNotesService.updateSettings(topicId, dto);
  }
}
