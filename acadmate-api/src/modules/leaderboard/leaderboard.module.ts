import { Module } from '@nestjs/common';
import { LeaderboardController, AdminLeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  controllers: [LeaderboardController, AdminLeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
