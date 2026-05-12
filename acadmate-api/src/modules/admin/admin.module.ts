import { Module } from '@nestjs/common';
import { AdminQuestionsController } from './questions/admin-questions.controller';
import { AdminQuestionsService } from './questions/admin-questions.service';
import { AdminImportsController } from './imports/admin-imports.controller';
import { ImportService } from './imports/import.service';
import { AdminSubjectsController } from './subjects/admin-subjects.controller';
import { AdminSubjectsService } from './subjects/admin-subjects.service';
import { AdminProseController } from './prose/admin-prose.controller';
import { AdminProseService } from './prose/admin-prose.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminNotificationsController } from './notifications/admin-notifications.controller';
import { AdminNotificationsService } from './notifications/admin-notifications.service';
import { AdminStatsController } from './stats/admin-stats.controller';
import { AdminStatsService } from './stats/admin-stats.service';
import { AdminTokensController } from './tokens/admin-tokens.controller';
import { AdminTokensService } from './tokens/admin-tokens.service';
import { AdminBlogController } from './blog/admin-blog.controller';
import { BlogModule } from '../blog/blog.module';

@Module({
  imports: [BlogModule],
  controllers: [
    AdminQuestionsController,
    AdminImportsController,
    AdminSubjectsController,
    AdminProseController,
    AdminUsersController,
    AdminNotificationsController,
    AdminStatsController,
    AdminTokensController,
    AdminBlogController,
  ],
  providers: [
    AdminQuestionsService,
    ImportService,
    AdminSubjectsService,
    AdminProseService,
    AdminUsersService,
    AdminNotificationsService,
    AdminStatsService,
    AdminTokensService,
  ],
})
export class AdminModule {}
