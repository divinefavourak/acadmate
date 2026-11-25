import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, type JwtUser } from '../../../common/decorators/current-user.decorator';
import { MAX_REMINDERS_PER_DAY, SettingsService } from '../../settings/settings.service';
import { MailService } from '../../auth/mail.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ALL_REMINDER_VARIANTS } from '../../auth/email-templates';
import { unsubscribeUrl } from '../../../common/utils/unsubscribe-token';
import { EngagementService } from '../../engagement/engagement.service';
import { mailAddress } from '../../../common/utils/mail-address';

class UpdateEmailRemindersDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_REMINDERS_PER_DAY) dailyLimit?: number;
}

class UpdateDeliveryEmailDto {
  /** An address, or null / empty to go back to the sign-in address. */
  @ValidateIf((o: UpdateDeliveryEmailDto) => o.deliveryEmail !== null && o.deliveryEmail !== '')
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  deliveryEmail!: string | null;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings/email-reminders')
export class AdminEmailRemindersController {
  constructor(
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly engagement: EngagementService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Letter settings, whether email is configured, and where your own mail goes' })
  async get(@CurrentUser() admin: JwtUser) {
    const [settings, me] = await Promise.all([this.settings.getEmailReminders(), this.addresses(admin.id)]);
    return { ...settings, mailReady: this.mail.isReady, ...me };
  }

  @Patch()
  @ApiOperation({ summary: 'Turn practice reminders on or off, or change the daily batch' })
  update(@Body() dto: UpdateEmailRemindersDto) {
    return this.settings.setEmailReminders(dto);
  }

  /**
   * Sets where your own mail goes (password resets, test sends, blog alerts),
   * for when your sign-in address can't receive email. Sign-in is unchanged.
   */
  @Patch('delivery-email')
  @ApiOperation({ summary: 'Send your mail to another address; sign-in stays the same' })
  async setDeliveryEmail(@CurrentUser() admin: JwtUser, @Body() dto: UpdateDeliveryEmailDto) {
    const wanted = dto.deliveryEmail?.trim().toLowerCase() || null;
    const me = await this.addresses(admin.id);
    // Setting it to the sign-in address is the same as clearing it.
    const deliveryEmail = wanted && wanted !== me.loginEmail.toLowerCase() ? wanted : null;
    await this.prisma.user.update({ where: { id: admin.id }, data: { deliveryEmail } });
    return { loginEmail: me.loginEmail, deliveryEmail };
  }

  /** Sends the welcome email and one of each letter (expired ones too) to the admin asking, to preview them. */
  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Email yourself the welcome email and every letter' })
  async test(@CurrentUser() admin: JwtUser) {
    const me = await this.prisma.user.findUnique({
      where: { id: admin.id },
      select: { email: true, deliveryEmail: true, name: true },
    });
    if (!me || !mailAddress(me)) return { sent: 0 };
    const to = mailAddress(me);
    const posts = await this.engagement.latestBlogPosts();
    await this.mail.sendWelcome(to, me.name);
    for (const variant of ALL_REMINDER_VARIANTS) {
      await this.mail.sendReminder(to, me.name, variant, unsubscribeUrl(admin.id), posts);
    }
    return { sent: 1 + ALL_REMINDER_VARIANTS.length, to };
  }

  private async addresses(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, deliveryEmail: true } });
    return { loginEmail: me?.email ?? '', deliveryEmail: me?.deliveryEmail ?? null };
  }
}
