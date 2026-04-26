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
