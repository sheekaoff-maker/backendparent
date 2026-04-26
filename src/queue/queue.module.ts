import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommandQueueService } from './command-queue.service';
import { CommandQueueProcessor } from './command-queue.processor';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
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
