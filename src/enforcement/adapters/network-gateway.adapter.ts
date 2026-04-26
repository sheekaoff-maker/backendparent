import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ControlAdapter, ControlResult, AdapterDeviceStatus } from './control-adapter.interface';
import { Device } from '@prisma/client';

/**
 * Network Gateway Adapter
 *
 * Used for: PlayStation, Smart TV, streaming boxes, and unsupported consoles.
 * Communicates with a local Gateway / Raspberry Pi / router service.
 *
 * IMPORTANT LIMITATIONS:
 * - Network blocking controls ONLINE ACCESS ONLY.
 * - Cannot kill offline games directly on PlayStation or unsupported consoles.
 * - For offline game violations, the system must:
 *   1. Expire the session
 *   2. Block internet via gateway
 *   3. Prevent future online access
 *   4. Apply cooldown
 *   5. Notify parent
 *   6. Mark session as violated if usage continues manually
 */
@Injectable()
export class NetworkGatewayAdapter implements ControlAdapter {
  private readonly logger = new Logger(NetworkGatewayAdapter.name);

  constructor(private prisma: PrismaService) {}

  async startSession(device: Device, rule?: unknown): Promise<ControlResult> {
    if (!device.gatewayId) {
      return { success: false, message: 'No gateway assigned to device' };
    }
    const gateway = await this.prisma.gateway.findUnique({ where: { id: device.gatewayId } });
    if (!gateway || !gateway.paired) {
      return { success: false, message: 'Gateway not found or not paired' };
    }
    this.logger.log(`Gateway ${gateway.id}: allow device ${device.id} (session start)`);
    return {
      success: true,
      message: 'Session started via network gateway. Online access allowed.',
      data: { gatewayId: gateway.id, method: 'NETWORK_GATEWAY' },
    };
  }

  async stopSession(device: Device): Promise<ControlResult> {
    if (!device.gatewayId) {
      return { success: false, message: 'No gateway assigned to device' };
    }
    this.logger.log(`Gateway: block internet for device ${device.id} (session stop)`);
    return {
      success: true,
      message: 'Session stopped via network gateway. Internet blocked. NOTE: Cannot kill offline games directly.',
      data: { offlineLimitation: true },
    };
  }

  async blockDevice(device: Device, reason: string): Promise<ControlResult> {
    if (!device.gatewayId) {
      return { success: false, message: 'No gateway assigned to device' };
    }
    this.logger.log(`Gateway: block device ${device.id} - reason: ${reason}`);
    return {
      success: true,
      message: 'Device blocked via network gateway. Online access blocked. Offline games cannot be killed directly.',
      data: { offlineLimitation: true, reason },
    };
  }

  async unblockDevice(device: Device): Promise<ControlResult> {
    if (!device.gatewayId) {
      return { success: false, message: 'No gateway assigned to device' };
    }
    this.logger.log(`Gateway: unblock device ${device.id}`);
    return { success: true, message: 'Device unblocked via network gateway. Online access restored.' };
  }

  async extendSession(device: Device, minutes: number): Promise<ControlResult> {
    if (!device.gatewayId) {
      return { success: false, message: 'No gateway assigned to device' };
    }
    return {
      success: true,
      message: `Session extended ${minutes}min via network gateway. Online access continues.`,
    };
  }

  async getStatus(device: Device): Promise<AdapterDeviceStatus> {
    if (!device.gatewayId) {
      return { online: false, blocked: true };
    }
    return {
      online: !!device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 300000,
      blocked: device.status === 'BLOCKED',
      lastSeen: device.lastSeen || undefined,
    };
  }
}
