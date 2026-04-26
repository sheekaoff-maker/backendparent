import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { DnsPolicyService } from './dns-policy.service';
import { DnsPolicyController } from './dns-policy.controller';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => ({
        store: redisStore as any,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        ttl: 30000,
      }),
    }),
  ],
  controllers: [DnsPolicyController],
  providers: [DnsPolicyService],
  exports: [DnsPolicyService],
})
export class DnsPolicyModule {}
