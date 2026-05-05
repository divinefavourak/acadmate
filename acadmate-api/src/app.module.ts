import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ResultsModule } from './modules/results/results.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { ProseModule } from './modules/prose/prose.module';
import { FlagsModule } from './modules/flags/flags.module';
import { UploadModule } from './modules/upload/upload.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // ── Load .env FIRST so all modules can read env vars ─────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Rate limiting: 100 req / 60s per IP ──────────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // ── Cron scheduler ────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Database ──────────────────────────────────────────────────────────
    PrismaModule,

    // ── Feature modules ───────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    ExamsModule,
    ResultsModule,
    AnalyticsModule,
    QuestionsModule,
    SubjectsModule,
    ProseModule,
    FlagsModule,
    UploadModule,
    SchedulerModule,
    AdminModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
