import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { getRedisConfig } from '../common/redis-config';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => {
        const cfg = getRedisConfig();
        return {
          store: redisStore as any,
          url: cfg.url,
          socket: { host: cfg.host, port: cfg.port, tls: cfg.tls },
          username: cfg.username,
          password: cfg.password,
          ttl: 30000,
        };
      },
    }),
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
