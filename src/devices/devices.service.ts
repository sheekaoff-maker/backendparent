import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { DeviceStatus } from '@prisma/client';
import { getPlatformSupport } from '../platform-support/platform-support.matrix';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async create(parentId: string, dto: CreateDeviceDto) {
    return this.prisma.device.create({
      data: {
        parentId,
        childId: dto.childId,
        name: dto.name,
        type: dto.type,
        platform: dto.platform,
        macAddress: dto.macAddress,
        ipAddress: dto.ipAddress,
        controlMethod: dto.controlMethod || 'MOCK',
        gatewayId: dto.gatewayId,
      },
    });
  }

  async findAll(parentId: string) {
    const devices = await this.prisma.device.findMany({
      where: { parentId },
      include: { child: true },
    });
    return devices.map((d) => this.withSupport(d));
  }

  async findOne(parentId: string, id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { child: true },
    });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');
    return this.withSupport(device);
  }

  /**
   * Attach honest platform-support metadata to a device payload so the parent app
   * can render correct UI (warnings for unsupported offline games, etc).
   */
  private withSupport<T extends { type: any }>(device: T) {
    const support = getPlatformSupport(device.type);
    return {
      ...device,
      offlineControlSupported: support.offlineControlSupported,
      offlineControlMethod: support.offlineControlMethod,
      recommendedControlMethod: support.recommendedControlMethod,
      supportNotes: support.notes,
    };
  }

  async findById(id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { child: true, parent: true },
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(parentId: string, id: string, dto: UpdateDeviceDto) {
    await this.findOne(parentId, id);
    return this.prisma.device.update({
      where: { id },
      data: dto,
    });
  }

  async remove(parentId: string, id: string) {
    await this.findOne(parentId, id);
    await this.prisma.device.delete({ where: { id } });
  }

  async updateStatus(id: string, status: DeviceStatus) {
    return this.prisma.device.update({
      where: { id },
      data: { status, lastSeen: new Date() },
    });
  }
}
