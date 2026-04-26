import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ControlAdapter, ControlResult, AdapterDeviceStatus } from './control-adapter.interface';
import { Device, CommandType } from '@prisma/client';

/**
 * iOS Screen Time Adapter
 *
 * IMPORTANT TODO: Apple Family Controls entitlement and native Swift implementation required.
 * This adapter stores rules and syncs them to the iOS child agent app.
 * The iOS agent must implement:
 * - FamilyControls framework
 * - ManagedSettings framework
 * - DeviceActivity framework
 * - Screen Time API
 *
 * Without the Apple Family Controls entitlement, this adapter cannot enforce restrictions
 * on iOS devices. The entitlement must be requested from Apple.
 */
@Injectable()
export class IosScreenTimeAdapter implements ControlAdapter {
  constructor(private prisma: PrismaService) {}

  async startSession(device: Device, rule?: unknown): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.SYNC_RULES, JSON.stringify(rule || {}));
    return {
      success: true,
      message: 'Rules synced to iOS agent. TODO: Requires Apple Family Controls entitlement + native Swift implementation.',
    };
  }

  async stopSession(device: Device): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.SYNC_RULES, JSON.stringify({ action: 'stop_session' }));
    return { success: true, message: 'Stop session command synced to iOS agent' };
  }

  async blockDevice(device: Device, reason: string): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.BLOCK_APPS, JSON.stringify({ reason }));
    return { success: true, message: 'Block command synced to iOS agent. Requires ManagedSettings framework.' };
  }

  async unblockDevice(device: Device): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.UNBLOCK_APPS, JSON.stringify({ action: 'unblock' }));
    return { success: true, message: 'Unblock command synced to iOS agent' };
  }

  async extendSession(device: Device, minutes: number): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.SYNC_RULES, JSON.stringify({ extendMinutes: minutes }));
    return { success: true, message: `Extend ${minutes}min synced to iOS agent` };
  }

  async getStatus(device: Device): Promise<AdapterDeviceStatus> {
    return {
      online: !!device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 300000,
      blocked: device.status === 'BLOCKED',
      lastSeen: device.lastSeen || undefined,
    };
  }

  private async createCommand(deviceId: string, type: CommandType, payload: string) {
    return this.prisma.command.create({
      data: { deviceId, type, payload },
    });
  }
}
