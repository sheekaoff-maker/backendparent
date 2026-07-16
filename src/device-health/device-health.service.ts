import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../common/prisma.service';
import {
  DeviceHealthState,
  DeviceHealthVerdict,
  evaluateDeviceHealth,
} from './device-health.types';

export interface DeviceHealthItem extends DeviceHealthVerdict {
  deviceId: string;
  name: string;
  type: string;
  childId: string | null;
}

export interface DeviceHealthSummary {
  generatedAt: string;
  total: number;
  /** How many devices we can currently confirm are being filtered. */
  protectedCount: number;
  needsAttentionCount: number;
  notConfiguredCount: number;
  counts: Record<DeviceHealthState, number>;
  devices: DeviceHealthItem[];
}

const SUMMARY_TTL_MS = 15_000;

@Injectable()
export class DeviceHealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getSummary(parentId: string): Promise<DeviceHealthSummary> {
    const cacheKey = `device-health:${parentId}`;
    const cached = await this.cache.get<DeviceHealthSummary>(cacheKey);
    if (cached) return cached;

    const devices = await this.prisma.device.findMany({
      where: { parentId },
      select: {
        id: true,
        name: true,
        type: true,
        childId: true,
        dnsConfigured: true,
        lastDnsSeenAt: true,
        internetLocked: true,
      },
      orderBy: { name: 'asc' },
    });

    const activeDeviceIds = await this.activeSessionDeviceIds(parentId);
    const now = new Date();

    const items: DeviceHealthItem[] = devices.map((device) => {
      const verdict = evaluateDeviceHealth(
        {
          dnsConfigured: device.dnsConfigured,
          lastDnsSeenAt: device.lastDnsSeenAt,
          internetLocked: device.internetLocked,
          hasActiveSession: activeDeviceIds.has(device.id),
        },
        now,
      );
      return {
        deviceId: device.id,
        name: device.name,
        type: device.type,
        childId: device.childId,
        ...verdict,
      };
    });

    const counts: Record<DeviceHealthState, number> = {
      VERIFIED: 0,
      IDLE: 0,
      NEEDS_ATTENTION: 0,
      NEVER_VERIFIED: 0,
      NOT_CONFIGURED: 0,
    };
    for (const item of items) counts[item.state] += 1;

    const summary: DeviceHealthSummary = {
      generatedAt: now.toISOString(),
      total: items.length,
      protectedCount: counts.VERIFIED,
      needsAttentionCount: counts.NEEDS_ATTENTION + counts.NEVER_VERIFIED,
      notConfiguredCount: counts.NOT_CONFIGURED,
      counts,
      devices: items,
    };

    await this.cache.set(cacheKey, summary, SUMMARY_TTL_MS);
    return summary;
  }

  async getForDevice(parentId: string, deviceId: string): Promise<DeviceHealthItem> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        name: true,
        type: true,
        childId: true,
        parentId: true,
        dnsConfigured: true,
        lastDnsSeenAt: true,
        internetLocked: true,
      },
    });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');

    const activeDeviceIds = await this.activeSessionDeviceIds(parentId);
    const verdict = evaluateDeviceHealth({
      dnsConfigured: device.dnsConfigured,
      lastDnsSeenAt: device.lastDnsSeenAt,
      internetLocked: device.internetLocked,
      hasActiveSession: activeDeviceIds.has(device.id),
    });

    return {
      deviceId: device.id,
      name: device.name,
      type: device.type,
      childId: device.childId,
      ...verdict,
    };
  }

  private async activeSessionDeviceIds(parentId: string): Promise<Set<string>> {
    const sessions = await this.prisma.session.findMany({
      where: { parentId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { deviceId: true },
    });
    return new Set(sessions.map((s) => s.deviceId));
  }
}
