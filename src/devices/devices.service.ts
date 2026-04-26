import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { DeviceStatus } from '@prisma/client';
import { getPlatformSupport } from '../platform-support/platform-support.matrix';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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
  private async invalidateDnsCacheForDevice(device: { ipAddress: string | null; dnsSourceIp: string | null }) {
    const ips = [device.ipAddress, device.dnsSourceIp].filter(Boolean) as string[];
    for (const ip of ips) {
      try {
        // cache-manager v5 doesn't expose a wildcard delete; rely on store-level reset
        // for the per-IP keys. Best-effort: try to delete a couple of common keys; the
        // 30s TTL guarantees eventual consistency anyway.
        const store: any = (this.cacheManager as any).store;
        if (store?.keys) {
          const keys: string[] = await store.keys(`dns:${ip}:*`);
          for (const k of keys) await this.cacheManager.del(k);
        }
      } catch {
        // ignore; TTL will expire shortly
      }
    }
  }
}
