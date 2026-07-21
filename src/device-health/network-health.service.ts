import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { DeviceHealthService } from './device-health.service';
import { computeNetworkHealth, NetworkHealthSummary } from './network-health.types';

@Injectable()
export class NetworkHealthService {
  constructor(
    private prisma: PrismaService,
    private deviceHealth: DeviceHealthService,
  ) {}

  async getSummary(parentId: string): Promise<NetworkHealthSummary> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [dnsSummary, gateways, devices] = await Promise.all([
      this.deviceHealth.getSummary(parentId),
      this.prisma.gateway.findMany({ where: { parentId }, select: { id: true, lastSeen: true } }),
      this.prisma.device.findMany({ where: { parentId }, select: { id: true, status: true, protectionStatus: true } }),
    ]);

    const gatewayIds = gateways.map((g) => g.id);
    const deviceIds = devices.map((d) => d.id);

    const [detectedRouters, recentCommands, vpnDetections24h, dohDetections24h] = await Promise.all([
      gatewayIds.length > 0
        ? this.prisma.detectedRouter.findMany({ where: { gatewayId: { in: gatewayIds } }, select: { lastTestResult: true } })
        : Promise.resolve([]),
      gatewayIds.length > 0
        ? this.prisma.routerCommand.findMany({
            where: { gatewayId: { in: gatewayIds }, status: { in: ['ACKNOWLEDGED', 'FAILED'] } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { status: true },
          })
        : Promise.resolve([]),
      gatewayIds.length > 0
        ? this.prisma.vpnDetectionLog.count({ where: { gatewayId: { in: gatewayIds }, detectedAt: { gte: since24h } } })
        : Promise.resolve(0),
      deviceIds.length > 0
        ? this.prisma.auditLog.count({ where: { action: 'doh_dot_detected', entityId: { in: deviceIds }, createdAt: { gte: since24h } } })
        : Promise.resolve(0),
    ]);

    const testedRouters = detectedRouters.filter((r) => r.lastTestResult !== null);
    const healthyRouters = testedRouters.filter((r) => r.lastTestResult === true);

    const bypassSuspectedDeviceCount = devices.filter((d) => d.protectionStatus !== 'NORMAL').length;
    const devicesOnline = devices.filter((d) => d.status === 'ONLINE').length;

    const lastSynchronization = gateways.reduce<Date | null>((latest, g) => {
      if (!g.lastSeen) return latest;
      if (!latest || g.lastSeen > latest) return g.lastSeen;
      return latest;
    }, null);

    return computeNetworkHealth({
      dns: { total: dnsSummary.total, protectedCount: dnsSummary.protectedCount },
      router: { tested: testedRouters.length, healthy: healthyRouters.length, anyGateway: gateways.length > 0 },
      plugin: {
        considered: recentCommands.length,
        succeeded: recentCommands.filter((c) => c.status === 'ACKNOWLEDGED').length,
      },
      vpnDetections24h,
      bypassSuspectedDeviceCount,
      dohDetections24h,
      devicesOnline,
      devicesTotal: devices.length,
      lastSynchronization,
    });
  }
}
