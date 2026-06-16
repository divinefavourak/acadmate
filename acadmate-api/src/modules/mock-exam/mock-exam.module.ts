import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockExamController } from './mock-exam.controller';
import { MockExamAdminController } from './mock-exam-admin.controller';
import { MockExamService } from './mock-exam.service';
import { MockParticipantGuard } from './guards/mock-participant.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MockExamController, MockExamAdminController],
  providers: [MockExamService, MockParticipantGuard],
  exports: [MockExamService],
})
export class MockExamModule {}
