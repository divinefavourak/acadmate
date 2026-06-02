import { IsEnum } from 'class-validator';
import { LiveSessionStatus } from '@prisma/client';

export class UpdateLiveSessionStatusDto {
  @IsEnum(LiveSessionStatus)
  status: LiveSessionStatus;
}
