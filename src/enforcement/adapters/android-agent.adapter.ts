import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ControlAdapter, ControlResult, AdapterDeviceStatus } from './control-adapter.interface';
import { Device, CommandType } from '@prisma/client';
import { CommandQueueService } from '../../queue/command-queue.service';

@Injectable()
export class AndroidAgentAdapter implements ControlAdapter {
  constructor(
    private prisma: PrismaService,
    @Optional() private commandQueue: CommandQueueService,
  ) {}

  async startSession(device: Device, rule?: unknown): Promise<ControlResult> {
    await this.createCommand(device, CommandType.SYNC_RULES, JSON.stringify(rule || {}));
    await this.createCommand(device, CommandType.BLOCK_APPS, JSON.stringify({ action: 'start_session' }));
    return { success: true, message: 'Session started: commands queued for Android agent' };
  }

  async stopSession(device: Device): Promise<ControlResult> {
    await this.createCommand(device, CommandType.UNBLOCK_APPS, JSON.stringify({ action: 'stop_session' }));
    return { success: true, message: 'Session stopped: commands queued for Android agent' };
  }

  async blockDevice(device: Device, reason: string): Promise<ControlResult> {
    await this.createCommand(device, CommandType.LOCK_DEVICE, JSON.stringify({ reason }));
    return { success: true, message: 'Block command queued for Android agent' };
  }

  async unblockDevice(device: Device): Promise<ControlResult> {
    await this.createCommand(device, CommandType.UNBLOCK_APPS, JSON.stringify({ action: 'unblock' }));
    return { success: true, message: 'Unblock command queued for Android agent' };
  }

  async extendSession(device: Device, minutes: number): Promise<ControlResult> {
    await this.createCommand(device, CommandType.SYNC_RULES, JSON.stringify({ extendMinutes: minutes }));
    return { success: true, message: `Extend ${minutes}min command queued for Android agent` };
  }

  async getStatus(device: Device): Promise<AdapterDeviceStatus> {
    const lastAck = await this.prisma.command.findFirst({
      where: { deviceId: device.id, status: 'ACKNOWLEDGED' },
      orderBy: { ackedAt: 'desc' },
    });
    return {
      online: !!device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 300000,
      blocked: device.status === 'BLOCKED',
      lastSeen: device.lastSeen || undefined,
    };
  }

  private async createCommand(device: Device, type: CommandType, payload: string) {
    const command = await this.prisma.command.create({
      data: { deviceId: device.id, type, payload },
    });

    if (this.commandQueue) {
      await this.commandQueue.enqueueCommand({
        commandId: command.id,
        deviceId: device.id,
        type,
        payload,
        controlMethod: device.controlMethod,
      });
    }

    return command;
  }
}
