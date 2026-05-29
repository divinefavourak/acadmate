import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

// @Global makes CacheService injectable everywhere without each module needing
// to explicitly import CacheModule. Only AppModule needs to import it once.
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
