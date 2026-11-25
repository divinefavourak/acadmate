import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
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

class UpdateEmailRemindersDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_REMINDERS_PER_DAY) dailyLimit?: number;
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
  @ApiOperation({ summary: 'Practice-reminder settings, and whether email is configured' })
  async get() {
    return { ...(await this.settings.getEmailReminders()), mailReady: this.mail.isReady };
  }

  @Patch()
  @ApiOperation({ summary: 'Turn practice reminders on or off, or change the daily batch' })
  update(@Body() dto: UpdateEmailRemindersDto) {
    return this.settings.setEmailReminders(dto);
  }

  /** Sends the welcome email and one of each letter (expired ones too) to the admin asking, to preview them. */
  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Email yourself the welcome email and every letter' })
  async test(@CurrentUser() admin: JwtUser) {
    const me = await this.prisma.user.findUnique({ where: { id: admin.id }, select: { email: true, name: true } });
    if (!me?.email) return { sent: 0 };
    const posts = await this.engagement.latestBlogPosts();
    await this.mail.sendWelcome(me.email, me.name);
    for (const variant of ALL_REMINDER_VARIANTS) {
      await this.mail.sendReminder(me.email, me.name, variant, unsubscribeUrl(admin.id), posts);
    }
    return { sent: 1 + ALL_REMINDER_VARIANTS.length, to: me.email };
  }
}
