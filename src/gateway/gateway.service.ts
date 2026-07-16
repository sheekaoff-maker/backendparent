import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GatewayService {
  constructor(private prisma: PrismaService) {}

  async register(parentId: string, name: string, endpoint?: string) {
    const token = uuidv4();
    return this.prisma.gateway.create({
      data: { parentId, name, token, endpoint },
    });
  }

  async pair(gatewayId: string, parentId: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');
    return this.prisma.gateway.update({
      where: { id: gatewayId },
      data: { paired: true, pairedAt: new Date() },
    });
  }

  async getDiscoveredDevices(gatewayId: string) {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
      include: { devices: true },
    });
    if (!gateway) throw new NotFoundException('Gateway not found');
    return gateway.devices;
  }

  async blockDevice(gatewayId: string, deviceMac: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    const device = await this.prisma.device.findFirst({
      where: { macAddress: deviceMac, gatewayId },
    });
    if (!device) throw new NotFoundException('Device not found on this gateway');
    await this.prisma.device.update({
      where: { id: device.id },
      data: { status: 'BLOCKED' },
    });
    return { success: true, message: `Device ${deviceMac} blocked via gateway` };
  }

  async unblockDevice(gatewayId: string, deviceMac: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    const device = await this.prisma.device.findFirst({
      where: { macAddress: deviceMac, gatewayId },
    });
    if (!device) throw new NotFoundException('Device not found on this gateway');
    await this.prisma.device.update({
      where: { id: device.id },
      data: { status: 'ONLINE' },
    });
    return { success: true, message: `Device ${deviceMac} unblocked via gateway` };
  }

  async getStatus(gatewayId: string) {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
      include: { devices: true },
    });
    if (!gateway) throw new NotFoundException('Gateway not found');
    return {
      id: gateway.id,
      name: gateway.name,
      paired: gateway.paired,
      lastSeen: gateway.lastSeen,
      deviceCount: gateway.devices.length,
      devices: gateway.devices.map(d => ({
        id: d.id,
        name: d.name,
        macAddress: d.macAddress,
        status: d.status,
      })),
    };
  }

  async getPolicies(gatewayId: string) {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
      include: {
        devices: {
          select: {
            id: true,
            name: true,
            macAddress: true,
            ipAddress: true,
            dnsSourceIp: true,
            status: true,
            internetLocked: true,
            internetLockedReason: true,
            internetLockedAt: true,
            blockingMode: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!gateway) throw new NotFoundException('Gateway not found');

    await this.updateLastSeen(gatewayId).catch(() => null);

    return {
      gatewayId: gateway.id,
      generatedAt: new Date().toISOString(),
      dnsRedirect: {
        enabled: true,
        resolverIp: process.env.CONTROLLED_DNS_IP || process.env.DNS_SERVICE_IP || null,
      },
      devices: gateway.devices.map((device) => {
        const shouldBlock = device.internetLocked || device.status === 'BLOCKED';
        const shouldThrottle = !shouldBlock && device.status === 'PAUSED';
        return {
          deviceId: device.id,
          name: device.name,
          macAddress: device.macAddress,
          ipAddress: device.ipAddress,
          dnsSourceIp: device.dnsSourceIp,
          action: shouldBlock ? 'BLOCK' : shouldThrottle ? 'THROTTLE' : 'ALLOW',
          reason: shouldBlock
            ? device.internetLockedReason ?? (device.status === 'BLOCKED' ? 'MANUAL_BLOCK' : 'FULL_INTERNET_LOCK')
            : shouldThrottle ? 'SOFT_PAUSE' : null,
          internetLocked: device.internetLocked,
          internetLockedAt: device.internetLockedAt,
          blockingMode: device.blockingMode,
          updatedAt: device.updatedAt,
        };
      }),
    };
  }

  async updateDiscoveredDevices(
    gatewayId: string,
    devices: Array<{ ipAddress: string; macAddress: string }>,
  ) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');

    const results = [];
    for (const discovered of devices) {
      const macAddress = discovered.macAddress.toLowerCase();
      const device = await this.prisma.device.findFirst({
        where: { gatewayId, macAddress },
      });
      if (!device) continue;

      results.push(
        await this.prisma.device.update({
          where: { id: device.id },
          data: {
            ipAddress: discovered.ipAddress,
            dnsSourceIp: discovered.ipAddress,
            lastSeen: new Date(),
          },
        }),
      );
    }

    await this.updateLastSeen(gatewayId).catch(() => null);
    return { updated: results.length };
  }

  async validateToken(token: string) {
    return this.prisma.gateway.findUnique({ where: { token } });
  }

  async updateLastSeen(gatewayId: string) {
    return this.prisma.gateway.update({
      where: { id: gatewayId },
      data: { lastSeen: new Date() },
    });
  }
}
