import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SettingsService } from '../../settings/settings.service';

class UpdatePaymentDetailsDto {
  // null clears the price; the upgrade page then says "ask on WhatsApp".
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(10_000_000)
  priceNaira?: number | null;

  @IsOptional() @IsString() @MaxLength(80) bankName?: string;
  @IsOptional() @IsString() @MaxLength(120) accountName?: string;

  @IsOptional() @IsString()
  @Matches(/^(\d{10})?$/, { message: 'Account number must be 10 digits' })
  accountNumber?: string;

  @IsOptional() @IsString()
  // International form for wa.me: country code first, so no leading 0.
  @Matches(/^[1-9]\d{9,14}$/, { message: 'WhatsApp number must start with the country code, like 2348012345678 (no leading 0)' })
  whatsappNumber?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings/payment')
export class AdminPaymentController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the Premium price, bank details and WhatsApp number' })
  get() {
    return this.settingsService.getPaymentDetails();
  }

  @Patch()
  @ApiOperation({ summary: 'Change the Premium price, bank details or WhatsApp number' })
  update(@Body() dto: UpdatePaymentDetailsDto) {
    return this.settingsService.setPaymentDetails(dto);
  }
}
