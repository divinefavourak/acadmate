import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsObject,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
} from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

class UpdateMeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(10) @Max(99) age?: number;
  @IsOptional() @IsInt() @Min(2024) @Max(2035) targetYear?: number;
  @IsOptional() @IsString() courseChoice?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsObject() avatarConfig?: Record<string, unknown>;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsArray() @ArrayMinSize(0) @ArrayMaxSize(5) @IsString({ each: true }) utmeSubjectIds?: string[];
}

class CompleteOnboardingDto {
  @IsOptional() @IsString() name?: string;
  @IsInt() @Min(10) @Max(99) age!: number;
  @IsString() institution!: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3) @IsString({ each: true }) utmeSubjectIds!: string[];
  @IsOptional() @IsObject() avatarConfig?: Record<string, unknown>;
  @IsOptional() @IsString() avatarUrl?: string;
}

class RedeemTokenDto {
  @IsString() code!: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: JwtUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete own account and all data' })
  deleteMe(@CurrentUser() user: JwtUser) {
    return this.usersService.deleteMe(user.id);
  }

  @Post('me/onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete first-time onboarding (age, institution, UTME subjects, avatar)' })
  completeOnboarding(
    @CurrentUser() user: JwtUser,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.usersService.completeOnboarding(user.id, dto);
  }

  @Post('me/redeem-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem an access code to upgrade to Premium' })
  redeemToken(@CurrentUser() user: JwtUser, @Body() dto: RedeemTokenDto) {
    return this.usersService.redeemToken(user.id, dto.code);
  }

  @Get('me/plan')
  @ApiOperation({ summary: 'Get current user plan' })
  getMyPlan(@CurrentUser() user: JwtUser) {
    return this.usersService.getMyPlan(user.id);
  }
}
