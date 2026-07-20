import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { DeviceStatus } from '@prisma/client';
import { getPlatformSupport } from '../platform-support/platform-support.matrix';
import { DnsPolicyService } from '../dns-policy/dns-policy.service';

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private dnsPolicyService: DnsPolicyService,
  ) {}

  async create(parentId: string, dto: CreateDeviceDto) {
    const device = await this.prisma.device.create({
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
    return this.redact(device);
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
      ...this.redact(device),
      offlineControlSupported: support.offlineControlSupported,
      offlineControlMethod: support.offlineControlMethod,
      recommendedControlMethod: support.recommendedControlMethod,
      supportNotes: support.notes,
    };
  }

  /**
   * dnsBeaconToken is a long-lived pairing/reaffirmation credential — it must
   * only ever be returned from the pairing endpoints that actually need it
   * (PairingService.getStatus), never from general device CRUD responses.
   */
  private redact<T extends Record<string, unknown>>(device: T): Omit<T, 'dnsBeaconToken'> {
    const { dnsBeaconToken: _dnsBeaconToken, ...rest } = device;
    return rest;
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
    const device = await this.prisma.device.update({
      where: { id },
      data: dto,
    });
    return this.redact(device);
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

  /**
   * Lock ALL internet for a device (online only — offline games still cannot be killed).
   * Sets blockingMode=FULL_INTERNET_LOCK and clears DNS cache for that device's IPs.
   */
  async lockInternet(parentId: string, id: string, reason?: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');

    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        blockingMode: 'FULL_INTERNET_LOCK',
        internetLocked: true,
        internetLockedReason: reason ?? 'Locked by parent',
        internetLockedAt: new Date(),
      },
    });
    await this.invalidateDnsCacheForDevice(updated);
    return this.withSupport(updated);
  }

  async unlockInternet(parentId: string, id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');

    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        blockingMode: 'GAMING_ONLY',
        internetLocked: false,
        internetLockedReason: null,
        internetLockedAt: null,
      },
    });
    await this.invalidateDnsCacheForDevice(updated);
    return this.withSupport(updated);
  }

  async getNetworkStatus(parentId: string, id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');

    const support = getPlatformSupport(device.type);
    return {
      deviceId: device.id,
      name: device.name,
      type: device.type,
      blockingMode: device.blockingMode,
      internetLocked: device.internetLocked,
      internetLockedReason: device.internetLockedReason,
      internetLockedAt: device.internetLockedAt,
      ipAddress: device.ipAddress,
      dnsSourceIp: device.dnsSourceIp,
      lastDnsSeenAt: device.lastDnsSeenAt,
      offlineControlSupported: support.offlineControlSupported,
      offlineControlMethod: support.offlineControlMethod,
      note: device.internetLocked
        ? 'All ONLINE traffic is blocked for this device. Offline single-player games cannot be killed by us.'
        : 'Standard policy in effect (gaming/category rules apply).',
    };
  }

  /**
   * Best-effort: clear cached DNS decisions for a device's known IPs so the new
   * lock/unlock policy takes effect immediately instead of waiting for TTL.
   */
  private async invalidateDnsCacheForDevice(device: {
    ipAddress: string | null;
    dnsSourceIp: string | null;
    ipv6Address?: string | null;
  }) {
    // Reliable, immediate invalidation: bump the per-IP DNS-policy cache version
    // so every cached decision for this device's IPs is instantly superseded.
    await this.dnsPolicyService.invalidateSourceIps([device.ipAddress, device.dnsSourceIp, device.ipv6Address]);
  }
}
