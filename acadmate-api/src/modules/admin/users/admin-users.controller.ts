import { Controller, Get, Delete, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { AdminUsersService } from './admin-users.service';

class PaginationQuery {
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
  @IsOptional() @IsEnum(Role) role?: Role;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get() listUsers(@Query() query: PaginationQuery) {
    return this.adminUsersService.listUsers(query.limit, query.offset, query.role);
  }

  @Get(':id/stats') getUserStats(@Param('id') id: string) {
    return this.adminUsersService.getUserStats(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string, @CurrentUser() admin: JwtUser) {
    return this.adminUsersService.deleteUser(id, admin.id);
  }
}
