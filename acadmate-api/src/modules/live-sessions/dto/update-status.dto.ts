import { IsIn } from 'class-validator';
import { LiveSessionStatus } from '@prisma/client';

export class UpdateLiveSessionStatusDto {
  // Only forward transitions are exposed; SCHEDULED is the initial state and is
  // never set via the API.
  @IsIn([LiveSessionStatus.ACTIVE, LiveSessionStatus.ENDED])
  status: LiveSessionStatus;
}
