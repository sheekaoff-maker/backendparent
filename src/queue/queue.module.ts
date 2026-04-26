import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommandQueueService } from './command-queue.service';
import { CommandQueueProcessor } from './command-queue.processor';
import { getRedisConfig } from '../common/redis-config';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const cfg = getRedisConfig();
        return {
          connection: {
            host: cfg.host,
            port: cfg.port,
            username: cfg.username,
            password: cfg.password,
            tls: cfg.tls ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'command-delivery',
    }),
  ],
  providers: [CommandQueueService, CommandQueueProcessor],
  exports: [CommandQueueService, BullModule],
})
export class QueueModule {}
