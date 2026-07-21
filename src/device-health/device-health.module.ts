import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { getRedisConfig, getRedisCacheSocketOptions } from '../common/redis-config';
import { DeviceHealthController } from './device-health.controller';
import { DeviceHealthService } from './device-health.service';
import { NetworkHealthService } from './network-health.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => {
        const cfg = getRedisConfig();
        return {
          store: redisStore as any,
          url: cfg.url,
          socket: { host: cfg.host, port: cfg.port, tls: cfg.tls, ...getRedisCacheSocketOptions() },
          username: cfg.username,
          password: cfg.password,
          ttl: 15000,
        };
      },
    }),
  ],
  controllers: [DeviceHealthController],
  providers: [DeviceHealthService, NetworkHealthService],
  exports: [DeviceHealthService, NetworkHealthService],
})
export class DeviceHealthModule {}
