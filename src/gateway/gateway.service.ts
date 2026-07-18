import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { computeFingerprintHash } from './device-fingerprint.util';

export interface DiscoveredDevice {
  ipAddress: string;
  macAddress: string;
  hostname?: string;
  dhcpClientId?: string;
  vendorOui?: string;
  osHint?: string;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

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
            vpnBlockEnabled: true,
            quicBlockEnabled: true,
            childId: true,
          },
        },
      },
    });
    if (!gateway) throw new NotFoundException('Gateway not found');

    await this.updateLastSeen(gatewayId).catch(() => null);

    const bandwidthLimits = await this.loadBandwidthLimits(gateway.devices);

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
          vpnBlock: device.vpnBlockEnabled,
          quicBlock: device.quicBlockEnabled,
          bandwidthLimits: this.resolveBandwidthLimits(device, bandwidthLimits),
          updatedAt: device.updatedAt,
        };
      }),
    };
  }

  /**
   * Layer 7: one query for the whole gateway rather than one per device —
   * a device can be matched either directly (deviceId) or via its child
   * (childId), so both ID sets are gathered up front.
   */
  private async loadBandwidthLimits(devices: Array<{ id: string; childId: string | null }>) {
    const deviceIds = devices.map((d) => d.id);
    const childIds = [...new Set(devices.map((d) => d.childId).filter((id): id is string => !!id))];
    if (deviceIds.length === 0 && childIds.length === 0) return [];

    const or: Array<Record<string, unknown>> = [];
    if (deviceIds.length > 0) or.push({ deviceId: { in: deviceIds } });
    if (childIds.length > 0) or.push({ childId: { in: childIds } });

    return this.prisma.bandwidthLimit.findMany({ where: { enabled: true, OR: or } });
  }

  /**
   * Resolves the effective per-category bandwidth policy for one device:
   * child-scoped limits apply to every device of that child, but a
   * device-specific limit for the same category (or the same "no category"
   * default bucket) always overrides it.
   */
  private resolveBandwidthLimits(
    device: { id: string; childId: string | null },
    allLimits: Array<{ deviceId: string | null; childId: string | null; category: string | null; downloadKbps: number | null; uploadKbps: number | null }>,
  ) {
    const byCategory = new Map<string, (typeof allLimits)[number]>();

    for (const limit of allLimits) {
      if (limit.childId && !limit.deviceId && limit.childId === device.childId) {
        byCategory.set(limit.category ?? '__default__', limit);
      }
    }
    for (const limit of allLimits) {
      if (limit.deviceId === device.id) {
        byCategory.set(limit.category ?? '__default__', limit);
      }
    }

    return [...byCategory.values()].map((limit) => ({
      category: limit.category ?? null,
      downloadKbps: limit.downloadKbps ?? null,
      uploadKbps: limit.uploadKbps ?? null,
    }));
  }

  async updateDiscoveredDevices(gatewayId: string, devices: DiscoveredDevice[]) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');

    const results = [];
    for (const discovered of devices) {
      const macAddress = discovered.macAddress.toLowerCase();
      const hostname = discovered.hostname ?? null;
      const dhcpClientId = discovered.dhcpClientId ?? null;
      const vendorOui = discovered.vendorOui ?? null;
      const osHint = discovered.osHint ?? null;

      // Primary match: same MAC on this gateway — unchanged from pre-Layer-4
      // behaviour, so existing pairings are never affected by this change.
      let device = await this.prisma.device.findFirst({ where: { gatewayId, macAddress } });

      // Fallback match: MAC didn't match (e.g. MAC randomization) but the
      // device carries the same hostname + DHCP client id we've seen before
      // on this gateway — treat it as the same physical device instead of
      // silently dropping the update (duplicate detection / merge).
      if (!device && hostname && dhcpClientId) {
        const merged = await this.prisma.device.findFirst({
          where: { gatewayId, hostname, dhcpClientId },
        });
        if (merged) {
          this.logger.log(
            `Merging discovered device into existing record ${merged.id}: mac changed ${merged.macAddress} -> ${macAddress}`,
          );
          device = merged;
        }
      }

      if (!device) continue;

      const fingerprintHash = computeFingerprintHash({
        macAddress,
        hostname: hostname ?? device.hostname,
        dhcpClientId: dhcpClientId ?? device.dhcpClientId,
        vendorOui: vendorOui ?? device.vendorOui,
      });

      results.push(
        await this.prisma.device.update({
          where: { id: device.id },
          data: {
            macAddress,
            ipAddress: discovered.ipAddress,
            dnsSourceIp: discovered.ipAddress,
            lastSeen: new Date(),
            hostname: hostname ?? device.hostname,
            dhcpClientId: dhcpClientId ?? device.dhcpClientId,
            vendorOui: vendorOui ?? device.vendorOui,
            osHint: osHint ?? device.osHint,
            fingerprintHash,
            fingerprintUpdatedAt: new Date(),
          },
        }),
      );
    }

    await this.updateLastSeen(gatewayId).catch(() => null);
    return { updated: results.length };
  }

  /**
   * Layer 5: persists every VPN-signature detection the gateway agent
   * reports (log-only — enforcement is driven separately by each device's
   * vpnBlockEnabled flag returned from getPolicies), so parents/admins have
   * a durable record of VPN usage regardless of whether blocking is on.
   */
  async recordVpnDetections(
    gatewayId: string,
    detections: Array<{ deviceId: string; provider: string; method: string; detail?: string }>,
  ) {
    if (detections.length === 0) return { recorded: 0 };

    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');

    const deviceIds = [...new Set(detections.map((d) => d.deviceId))];
    const knownDevices = await this.prisma.device.findMany({
      where: { gatewayId, id: { in: deviceIds } },
      select: { id: true },
    });
    const knownDeviceIds = new Set(knownDevices.map((d) => d.id));
    const valid = detections.filter((d) => knownDeviceIds.has(d.deviceId));

    if (valid.length > 0) {
      await this.prisma.vpnDetectionLog.createMany({
        data: valid.map((d) => ({
          gatewayId,
          deviceId: d.deviceId,
          provider: d.provider,
          method: d.method,
          detail: d.detail ?? null,
        })),
      });
      this.logger.warn(
        `Recorded ${valid.length} VPN detection(s) on gateway ${gatewayId}: ${valid
          .map((d) => `${d.deviceId}:${d.provider}`)
          .join(', ')}`,
      );
    }

    return { recorded: valid.length };
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
