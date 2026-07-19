import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { getRedisConfig, getRedisCacheSocketOptions } from '../common/redis-config';
import { PushModule } from '../push/push.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
    PushModule,
    CacheModule.registerAsync({
      useFactory: () => {
        const cfg = getRedisConfig();
        return {
          store: redisStore as any,
          url: cfg.url,
          socket: { host: cfg.host, port: cfg.port, tls: cfg.tls, ...getRedisCacheSocketOptions() },
          username: cfg.username,
          password: cfg.password,
          ttl: 5000,
        };
      },
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
