import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { computeFingerprintHash } from './device-fingerprint.util';
import { AuditService } from '../audit/audit.service';
import { GatewayType } from '@prisma/client';

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

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // An agent polling every POLL_INTERVAL_MS (default 3s, see gateway-agent's
  // config.js) that hasn't been seen in this long is treated as offline —
  // generous enough to absorb a transient hiccup/backoff, tight enough that
  // "Online" in the UI means something.
  private static readonly ONLINE_THRESHOLD_MS = 60 * 1000;

  /**
   * Parent-facing: every gateway they own, enriched with everything the
   * Gateway Dashboard card needs in one round trip — real, currently-tracked
   * data only (no fabricated "bandwidth"/"firewall status" numbers this
   * schema doesn't actually record).
   */
  async listGateways(parentId: string) {
    const gateways = await this.prisma.gateway.findMany({
      where: { parentId },
      select: {
        id: true,
        name: true,
        description: true,
        gatewayType: true,
        endpoint: true,
        paired: true,
        pairedAt: true,
        lastSeen: true,
        agentVersion: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = Date.now();

    return Promise.all(
      gateways.map(async (gateway) => {
        const deviceRows = await this.prisma.device.findMany({
          where: { gatewayId: gateway.id },
          select: { id: true },
        });
        const deviceIds = deviceRows.map((d) => d.id);

        const [detectedRouter, vpnDetectionCount24h, dohDetectionCount24h] = await Promise.all([
          this.prisma.detectedRouter.findUnique({
            where: { gatewayId: gateway.id },
            select: { vendor: true, model: true, integrationStatus: true, pluginId: true },
          }),
          this.prisma.vpnDetectionLog.count({
            where: { gatewayId: gateway.id, detectedAt: { gte: since24h } },
          }),
          deviceIds.length > 0
            ? this.prisma.auditLog.count({
                where: { action: 'doh_dot_detected', entityId: { in: deviceIds }, createdAt: { gte: since24h } },
              })
            : Promise.resolve(0),
        ]);

        return {
          ...gateway,
          online: !!gateway.lastSeen && now - gateway.lastSeen.getTime() <= GatewayService.ONLINE_THRESHOLD_MS,
          deviceCount: deviceIds.length,
          detectedRouter,
          vpnDetectionCount24h,
          dohDetectionCount24h,
        };
      }),
    );
  }

  /** Rename/re-describe a gateway — cosmetic only, no effect on its token or enforcement. */
  async renameGateway(parentId: string, gatewayId: string, name?: string, description?: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');

    return this.prisma.gateway.update({
      where: { id: gatewayId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });
  }

  /**
   * Removing a gateway never removes the devices it discovered — they keep
   * whatever DNS-based pairing/enforcement they already have independent of
   * any gateway (see PairingSession) — it just detaches them (gatewayId ->
   * null) and drops gateway-scoped rows (DetectedRouter, RouterCommand,
   * VpnDetectionLog) that are meaningless without the gateway they belong to.
   */
  async deleteGateway(parentId: string, gatewayId: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');

    await this.prisma.$transaction([
      this.prisma.device.updateMany({ where: { gatewayId }, data: { gatewayId: null } }),
      this.prisma.detectedRouter.deleteMany({ where: { gatewayId } }),
      this.prisma.routerCommand.deleteMany({ where: { gatewayId } }),
      this.prisma.vpnDetectionLog.deleteMany({ where: { gatewayId } }),
      this.prisma.gateway.delete({ where: { id: gatewayId } }),
    ]);

    return { deleted: true };
  }

  async register(
    parentId: string,
    name: string,
    endpoint?: string,
    gatewayType: GatewayType = GatewayType.SOFTWARE_AGENT,
    description?: string,
  ) {
    const token = uuidv4();
    // paired:true at creation — this endpoint is JWT-authenticated (only the
    // owning parent can call it) and the token is server-generated, so the
    // authorization event already happened by the time we get here. Setting
    // paired:false here would be a real bug: GatewayTokenGuard hard-rejects
    // any unpaired gateway (see gateway-token.guard.ts), and nothing else in
    // this codebase ever calls pair() automatically — a freshly registered
    // gateway would be permanently unable to authenticate once the agent
    // tries to connect with its brand-new token.
    return this.prisma.gateway.create({
      data: { parentId, name, token, endpoint, gatewayType, description, paired: true, pairedAt: new Date() },
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

  /**
   * Security incident response (leaked/compromised token) without bricking
   * an already-deployed gateway-agent: the old token keeps authenticating
   * for `gracePeriodMs` (default 24h — long enough for a router that only
   * polls every few seconds to notice within its next cycle, short enough
   * to bound how long a leaked token stays useful) via
   * GatewayTokenGuard's previousToken fallback. The running agent picks up
   * the new token automatically the next time it calls getPolicies() (see
   * `rotatedToken` below) — no manual re-pairing/reflash needed.
   */
  async rotateToken(parentId: string, gatewayId: string, gracePeriodMs = 24 * 60 * 60 * 1000) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');

    const newToken = uuidv4();
    const previousTokenExpiresAt = new Date(Date.now() + gracePeriodMs);

    const updated = await this.prisma.gateway.update({
      where: { id: gatewayId },
      data: {
        token: newToken,
        previousToken: gateway.token,
        previousTokenExpiresAt,
      },
    });

    await this.audit.log({
      userId: parentId,
      action: 'gateway.token_rotated',
      entity: 'gateway',
      entityId: gatewayId,
      details: JSON.stringify({ previousTokenExpiresAt: previousTokenExpiresAt.toISOString() }),
    });
    this.logger.warn(`Gateway ${gatewayId} token rotated by parent ${parentId}; old token valid until ${previousTokenExpiresAt.toISOString()}`);

    return { id: updated.id, token: updated.token, previousTokenExpiresAt: updated.previousTokenExpiresAt };
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

  async getPolicies(gatewayId: string, usedPreviousToken = false, agentVersion?: string) {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
      include: {
        devices: {
          select: {
            id: true,
            name: true,
            macAddress: true,
            ipAddress: true,
            ipv6Address: true,
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

    await this.updateLastSeen(gatewayId, agentVersion).catch(() => null);

    const bandwidthLimits = await this.loadBandwidthLimits(gateway.devices);

    return {
      gatewayId: gateway.id,
      generatedAt: new Date().toISOString(),
      // Self-healing token rotation: only present when this request
      // authenticated via the previous (rotated-out) token — tells
      // gateway-agent's policy-sync loop "here's your new token", so it
      // updates its in-memory config and persists it to .env without any
      // manual re-pairing. Absent on every normal request.
      rotatedToken: usedPreviousToken ? gateway.token : undefined,
      dnsRedirect: {
        enabled: true,
        resolverIp: process.env.CONTROLLED_DNS_IP || process.env.DNS_SERVICE_IP || null,
        // Nullable on purpose: an IPv6 DNAT rule pointed at a resolver with
        // no IPv6 listener would just blackhole v6 DNS. gateway-agent skips
        // the v6 DNS-redirect rule (but still applies v6 block/VPN/QUIC
        // rules) whenever this is unset — see iptables-controller.js.
        resolverIpv6: process.env.CONTROLLED_DNS_IPV6 || null,
      },
      devices: gateway.devices.map((device) => {
        const shouldBlock = device.internetLocked || device.status === 'BLOCKED';
        const shouldThrottle = !shouldBlock && device.status === 'PAUSED';
        return {
          deviceId: device.id,
          name: device.name,
          macAddress: device.macAddress,
          ipAddress: device.ipAddress,
          ipv6Address: device.ipv6Address,
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
    detections: Array<{
      deviceId: string;
      provider: string;
      method: string;
      detail?: string;
      confidence?: number;
      overallConfidence?: number;
    }>,
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
          confidence: d.confidence ?? null,
          overallConfidence: d.overallConfidence ?? null,
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

  /**
   * Layer 8 (DoH/DoT): encrypted-DNS detections go through AuditService
   * rather than a dedicated table like VpnDetectionLog — same
   * device-ownership validation, but this is a lower-volume, alert-shaped
   * signal (a device using DoH is not itself an enforcement action the way
   * a VPN detection can be), so the existing generic audit trail is the
   * right fit instead of a second near-identical table.
   */
  async recordDohDetections(
    gatewayId: string,
    detections: Array<{ deviceId: string; provider: string; method: string; detail?: string; confidence?: number }>,
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

    for (const detection of valid) {
      await this.audit.log({
        action: 'doh_dot_detected',
        entity: 'device',
        entityId: detection.deviceId,
        details: JSON.stringify({
          provider: detection.provider,
          method: detection.method,
          detail: detection.detail,
          confidence: detection.confidence,
        }),
      });
    }

    if (valid.length > 0) {
      this.logger.warn(
        `Recorded ${valid.length} DoH/DoT detection(s) on gateway ${gatewayId}: ${valid
          .map((d) => `${d.deviceId}:${d.provider}`)
          .join(', ')}`,
      );
    }

    return { recorded: valid.length };
  }

  async validateToken(token: string) {
    return this.prisma.gateway.findUnique({ where: { token } });
  }

  async updateLastSeen(gatewayId: string, agentVersion?: string) {
    return this.prisma.gateway.update({
      where: { id: gatewayId },
      // agentVersion is only ever set (never cleared) here — an older agent
      // build that doesn't send the header shouldn't wipe out a version a
      // newer build previously reported.
      data: { lastSeen: new Date(), ...(agentVersion ? { agentVersion } : {}) },
    });
  }
}
