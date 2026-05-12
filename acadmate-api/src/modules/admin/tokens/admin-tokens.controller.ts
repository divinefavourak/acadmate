import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { AdminTokensService } from './admin-tokens.service';

class GenerateTokenDto {
  @IsOptional() @IsString() note?: string;
}

class ListTokensQuery {
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number = 50;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/tokens')
export class AdminTokensController {
  constructor(private readonly adminTokensService: AdminTokensService) {}

  @Post()
  generateToken(@CurrentUser() admin: JwtUser, @Body() dto: GenerateTokenDto) {
    return this.adminTokensService.generateToken(admin.id, dto.note);
  }

  @Get()
  listTokens(@Query() query: ListTokensQuery) {
    return this.adminTokensService.listTokens(query.limit, query.offset);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteToken(@Param('id') id: string) {
    return this.adminTokensService.deleteToken(id);
  }
}
