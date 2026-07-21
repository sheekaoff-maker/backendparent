import { NetworkHealthService } from '../src/device-health/network-health.service';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: { findMany: jest.fn().mockResolvedValue([]), ...overrides.gateway },
    device: { findMany: jest.fn().mockResolvedValue([]), ...overrides.device },
    detectedRouter: { findMany: jest.fn().mockResolvedValue([]), ...overrides.detectedRouter },
    routerCommand: { findMany: jest.fn().mockResolvedValue([]), ...overrides.routerCommand },
    vpnDetectionLog: { count: jest.fn().mockResolvedValue(0), ...overrides.vpnDetectionLog },
    auditLog: { count: jest.fn().mockResolvedValue(0), ...overrides.auditLog },
  } as any;
}

function buildDeviceHealth(summary: any = {}) {
  return {
    getSummary: jest.fn().mockResolvedValue({ total: 0, protectedCount: 0, ...summary }),
  } as any;
}

describe('NetworkHealthService.getSummary', () => {
  it('reports an all-grey/Not-Configured household when the parent has no gateways or devices', async () => {
    const service = new NetworkHealthService(buildPrisma(), buildDeviceHealth());
    const result = await service.getSummary('parent-1');

    expect(result.router.state).toBe('Not Configured');
    expect(result.dns.state).toBe('Not Configured');
    expect(result.networkStability.state).toBe('Not Configured');
    expect(result.vpn.state).toBe('Not Detected');
    expect(result.privateDns.state).toBe('Disabled');
    expect(result.lastSynchronization).toBeNull();
  });

  it('skips the per-gateway/per-device DB queries entirely when there are no gateways or devices (no wasted round trips)', async () => {
    const prisma = buildPrisma();
    const service = new NetworkHealthService(prisma, buildDeviceHealth());

    await service.getSummary('parent-1');

    expect(prisma.detectedRouter.findMany).not.toHaveBeenCalled();
    expect(prisma.routerCommand.findMany).not.toHaveBeenCalled();
    expect(prisma.vpnDetectionLog.count).not.toHaveBeenCalled();
    expect(prisma.auditLog.count).not.toHaveBeenCalled();
  });

  it('aggregates router health from lastTestResult across every gateway the parent owns', async () => {
    const prisma = buildPrisma({
      gateway: { findMany: jest.fn().mockResolvedValue([{ id: 'gw-1', lastSeen: new Date('2026-07-21T10:00:00Z') }, { id: 'gw-2', lastSeen: null }]) },
      detectedRouter: {
        findMany: jest.fn().mockResolvedValue([{ lastTestResult: true }, { lastTestResult: false }, { lastTestResult: null }]),
      },
    });
    const service = new NetworkHealthService(prisma, buildDeviceHealth());

    const result = await service.getSummary('parent-1');

    // 1 healthy of 2 tested (the null one is excluded from the ratio).
    expect(result.router.percent).toBe(50);
    expect(result.lastSynchronization).toBe('2026-07-21T10:00:00.000Z');
  });

  it('derives Plugin Health from ACKNOWLEDGED vs FAILED RouterCommand rows only (PENDING/DELIVERED excluded by the query itself)', async () => {
    const prisma = buildPrisma({
      gateway: { findMany: jest.fn().mockResolvedValue([{ id: 'gw-1', lastSeen: new Date() }]) },
      routerCommand: {
        findMany: jest.fn().mockResolvedValue([{ status: 'ACKNOWLEDGED' }, { status: 'ACKNOWLEDGED' }, { status: 'FAILED' }]),
      },
    });
    const service = new NetworkHealthService(prisma, buildDeviceHealth());

    const result = await service.getSummary('parent-1');
    expect(result.plugin.percent).toBe(67); // 2/3 rounded
  });

  it('flags Private DNS bypass from Device.protectionStatus, and reuses DeviceHealthService for the DNS section rather than recomputing it', async () => {
    const prisma = buildPrisma({
      device: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'dev-1', status: 'ONLINE', protectionStatus: 'NORMAL' },
          { id: 'dev-2', status: 'OFFLINE', protectionStatus: 'POSSIBLE_DNS_BYPASS' },
        ]),
      },
    });
    const deviceHealth = buildDeviceHealth({ total: 2, protectedCount: 1 });
    const service = new NetworkHealthService(prisma, deviceHealth);

    const result = await service.getSummary('parent-1');

    expect(deviceHealth.getSummary).toHaveBeenCalledWith('parent-1');
    expect(result.dns.percent).toBe(50);
    expect(result.privateDns.state).toBe('Bypass Suspected');
    expect(result.networkStability.percent).toBe(50); // 1/2 online
  });
});
