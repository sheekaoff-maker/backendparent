import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { CommandJobData } from './command-queue.service';

@Processor('command-delivery')
export class CommandQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(CommandQueueProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<CommandJobData>): Promise<void> {
    const { commandId, deviceId, type, controlMethod } = job.data;
    this.logger.log(`Processing command ${commandId} (${type}) for device ${deviceId} via ${controlMethod}`);

    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      this.logger.warn(`Device ${deviceId} not found, skipping command ${commandId}`);
      return;
    }

    if (device.status === 'OFFLINE') {
      this.logger.warn(`Device ${deviceId} is offline, command ${commandId} will be retried`);
      throw new Error(`Device ${deviceId} is offline`);
    }

    await this.prisma.command.update({
      where: { id: commandId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });

    this.logger.log(`Command ${commandId} delivered to device ${deviceId}`);
  }
}
