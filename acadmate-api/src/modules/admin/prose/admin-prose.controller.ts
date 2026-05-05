import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminProseService } from './admin-prose.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/prose')
export class AdminProseController {
  constructor(private readonly adminProseService: AdminProseService) {}

  @Get() listProse() { return this.adminProseService.listProse(); }

  @Get(':id') getProseById(@Param('id') id: string) { return this.adminProseService.getProseById(id); }

  @Post() @HttpCode(HttpStatus.CREATED)
  createProse(@Body() dto: any) { return this.adminProseService.createProse(dto); }

  @Patch(':id')
  updateProse(@Param('id') id: string, @Body() dto: any) { return this.adminProseService.updateProse(id, dto); }

  @Delete(':id') @HttpCode(HttpStatus.OK)
  deleteProse(@Param('id') id: string) { return this.adminProseService.deleteProse(id); }

  @Post(':id/sections') @HttpCode(HttpStatus.CREATED)
  addSection(@Param('id') id: string, @Body() dto: any) { return this.adminProseService.addSection(id, dto); }

  @Patch(':id/sections/:sectionId')
  updateSection(@Param('id') id: string, @Param('sectionId') sectionId: string, @Body() dto: any) {
    return this.adminProseService.updateSection(id, sectionId, dto);
  }

  @Delete(':id/sections/:sectionId') @HttpCode(HttpStatus.OK)
  deleteSection(@Param('id') id: string, @Param('sectionId') sectionId: string) {
    return this.adminProseService.deleteSection(id, sectionId);
  }
}
