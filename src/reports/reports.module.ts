import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { getRedisConfig } from '../common/redis-config';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

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
          ttl: 300000,
        };
      },
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
