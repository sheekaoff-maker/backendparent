import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface CommandJobData {
  commandId: string;
  deviceId: string;
  type: string;
  payload: string;
  controlMethod: string;
}

@Injectable()
export class CommandQueueService {
  private readonly logger = new Logger(CommandQueueService.name);

  constructor(
    @InjectQueue('command-delivery') private commandQueue: Queue,
  ) {}

  async enqueueCommand(data: CommandJobData): Promise<void> {
    await this.commandQueue.add('deliver-command', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(`Command ${data.commandId} enqueued for device ${data.deviceId}`);
  }

  async getQueueStatus() {
    const [waiting, active, delayed, failed] = await Promise.all([
      this.commandQueue.getWaitingCount(),
      this.commandQueue.getActiveCount(),
      this.commandQueue.getDelayedCount(),
      this.commandQueue.getFailedCount(),
    ]);
    return { waiting, active, delayed, failed };
  }
}
