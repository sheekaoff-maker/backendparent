import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ControlAdapter, ControlResult, AdapterDeviceStatus } from './control-adapter.interface';
import { Device, CommandType } from '@prisma/client';

/**
 * iOS Screen Time Adapter
 *
 * Enforcement on iOS requires an Apple Family Controls entitlement (Apple-side
 * approval, weeks-long process) plus a native iOS agent implementing
 * FamilyControls/ManagedSettings/DeviceActivity — neither exists yet. Until
 * then this adapter must not report success: the command is queued (so a
 * future agent can pick it up), but every call reports failure so callers
 * (EnforcementService, the API response, the parent's UI) show an honest
 * "not supported on this device yet" instead of a false confirmation.
 */
const UNSUPPORTED_MESSAGE =
  'iOS enforcement is not available yet — it requires an Apple Family Controls entitlement and a native iOS agent that do not exist in this deployment. The action was not applied to the device.';

@Injectable()
export class IosScreenTimeAdapter implements ControlAdapter {
  constructor(private prisma: PrismaService) {}

  async startSession(device: Device, rule?: unknown): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.SYNC_RULES, JSON.stringify(rule || {}));
    return { success: false, message: UNSUPPORTED_MESSAGE };
  }

  async stopSession(device: Device): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.SYNC_RULES, JSON.stringify({ action: 'stop_session' }));
    return { success: false, message: UNSUPPORTED_MESSAGE };
  }

  async blockDevice(device: Device, reason: string): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.BLOCK_APPS, JSON.stringify({ reason }));
    return { success: false, message: UNSUPPORTED_MESSAGE };
  }

  async unblockDevice(device: Device): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.UNBLOCK_APPS, JSON.stringify({ action: 'unblock' }));
    return { success: false, message: UNSUPPORTED_MESSAGE };
  }

  async extendSession(device: Device, minutes: number): Promise<ControlResult> {
    await this.createCommand(device.id, CommandType.SYNC_RULES, JSON.stringify({ extendMinutes: minutes }));
    return { success: false, message: UNSUPPORTED_MESSAGE };
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
