import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { EncryptionService } from '../../common/encryption.service';
import { ControlAdapter, ControlResult, AdapterDeviceStatus } from './control-adapter.interface';
import { Device, ControlMethod } from '@prisma/client';

/**
 * Xbox Adapter
 *
 * Uses Microsoft OAuth account linking structure.
 * Stores encrypted OAuth tokens for Microsoft account.
 *
 * IMPORTANT: Direct family control APIs for Xbox are not publicly available.
 * If Microsoft Family Safety integration is unavailable, this adapter
 * falls back to NetworkGatewayAdapter for network-level blocking.
 *
 * Do NOT fake unsupported Microsoft APIs.
 */
@Injectable()
export class XboxAdapter implements ControlAdapter {
  private readonly logger = new Logger(XboxAdapter.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  async startSession(device: Device, rule?: unknown): Promise<ControlResult> {
    const oauth = await this.getOAuthAccount(device.parentId);
    if (!oauth) {
      this.logger.warn(`No Microsoft OAuth linked for device ${device.id}, falling back to network gateway`);
      return this.fallbackToGateway(device, 'startSession');
    }
    return {
      success: true,
      message: 'Xbox session rules stored. Microsoft Family Safety integration required for direct enforcement.',
      data: { hasOAuth: true, fallback: false },
    };
  }

  async stopSession(device: Device): Promise<ControlResult> {
    const oauth = await this.getOAuthAccount(device.parentId);
    if (!oauth) {
      return this.fallbackToGateway(device, 'stopSession');
    }
    return { success: true, message: 'Xbox stop session stored. Direct control depends on Microsoft API availability.' };
  }

  async blockDevice(device: Device, reason: string): Promise<ControlResult> {
    const oauth = await this.getOAuthAccount(device.parentId);
    if (!oauth) {
      return this.fallbackToGateway(device, 'blockDevice');
    }
    return { success: true, message: 'Xbox block stored. Direct enforcement depends on Microsoft Family Safety API.' };
  }

  async unblockDevice(device: Device): Promise<ControlResult> {
    const oauth = await this.getOAuthAccount(device.parentId);
    if (!oauth) {
      return this.fallbackToGateway(device, 'unblockDevice');
    }
    return { success: true, message: 'Xbox unblock stored. Direct enforcement depends on Microsoft Family Safety API.' };
  }

  async extendSession(device: Device, minutes: number): Promise<ControlResult> {
    const oauth = await this.getOAuthAccount(device.parentId);
    if (!oauth) {
      return this.fallbackToGateway(device, 'extendSession');
    }
    return { success: true, message: `Xbox extend ${minutes}min stored.` };
  }

  async getStatus(device: Device): Promise<AdapterDeviceStatus> {
    return {
      online: !!device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 300000,
      blocked: device.status === 'BLOCKED',
      lastSeen: device.lastSeen || undefined,
    };
  }

  private async getOAuthAccount(parentId: string) {
    return this.prisma.oAuthAccount.findFirst({
      where: { userId: parentId, provider: 'microsoft' },
    });
  }

  private async fallbackToGateway(device: Device, action: string): Promise<ControlResult> {
    if (device.gatewayId) {
      return {
        success: true,
        message: `No Microsoft OAuth linked. Falling back to network gateway for ${action}.`,
        data: { fallback: true, method: ControlMethod.NETWORK_GATEWAY, gatewayId: device.gatewayId },
      };
    }
    return {
      success: false,
      message: `No Microsoft OAuth linked and no gateway configured. Cannot enforce ${action} on Xbox.`,
      data: { fallback: true, method: null },
    };
  }
}
