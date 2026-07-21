import { GatewayService } from '../src/gateway/gateway.service';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.gateway,
    },
    device: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.device,
    },
    detectedRouter: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.detectedRouter,
    },
    vpnDetectionLog: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.vpnDetectionLog,
    },
    auditLog: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.auditLog,
    },
  } as any;
}

describe('GatewayService.listGateways', () => {
  it('scopes the query to the requesting parent, orders oldest first, and selects the enriched field set', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await service.listGateways('parent-1');

    expect(prisma.gateway.findMany).toHaveBeenCalledWith({
      where: { parentId: 'parent-1' },
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
  });

  it('returns an empty list for a parent with no gateways, without querying per-gateway aggregates', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.listGateways('parent-1');
    expect(result).toEqual([]);
    expect(prisma.device.findMany).not.toHaveBeenCalled();
  });

  it('marks a gateway online when lastSeen is within the freshness window', async () => {
    const gateway = { id: 'gw-1', name: 'Home', lastSeen: new Date() };
    const prisma = buildPrisma({ gateway: { findMany: jest.fn().mockResolvedValue([gateway]) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const [result] = await service.listGateways('parent-1');
    expect(result.online).toBe(true);
  });

  it('marks a gateway offline when lastSeen is stale (past the freshness window)', async () => {
    const staleGateway = { id: 'gw-1', name: 'Home', lastSeen: new Date(Date.now() - 5 * 60 * 1000) };
    const prisma = buildPrisma({ gateway: { findMany: jest.fn().mockResolvedValue([staleGateway]) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const [result] = await service.listGateways('parent-1');
    expect(result.online).toBe(false);
  });

  it('marks a gateway offline when it has never connected (lastSeen null)', async () => {
    const neverSeen = { id: 'gw-1', name: 'Home', lastSeen: null };
    const prisma = buildPrisma({ gateway: { findMany: jest.fn().mockResolvedValue([neverSeen]) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const [result] = await service.listGateways('parent-1');
    expect(result.online).toBe(false);
  });

  it('reports real deviceCount, detectedRouter, and 24h VPN/DoH detection counts per gateway', async () => {
    const gateway = { id: 'gw-1', name: 'Office', lastSeen: new Date() };
    const prisma = buildPrisma({
      gateway: { findMany: jest.fn().mockResolvedValue([gateway]) },
      device: { findMany: jest.fn().mockResolvedValue([{ id: 'dev-1' }, { id: 'dev-2' }]) },
      detectedRouter: {
        findUnique: jest.fn().mockResolvedValue({ vendor: 'MikroTik', model: 'RB750', integrationStatus: 'OFFICIAL_API', pluginId: 'mikrotik' }),
      },
      vpnDetectionLog: { count: jest.fn().mockResolvedValue(3) },
      auditLog: { count: jest.fn().mockResolvedValue(2) },
    });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const [result] = await service.listGateways('parent-1');

    expect(result.deviceCount).toBe(2);
    expect(result.detectedRouter?.vendor).toBe('MikroTik');
    expect(result.vpnDetectionCount24h).toBe(3);
    expect(result.dohDetectionCount24h).toBe(2);
    expect(prisma.vpnDetectionLog.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ gatewayId: 'gw-1' }) }),
    );
    expect(prisma.auditLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: 'doh_dot_detected', entityId: { in: ['dev-1', 'dev-2'] } }),
      }),
    );
  });

  it('skips the AuditLog query entirely when a gateway has no devices (nothing to match on)', async () => {
    const gateway = { id: 'gw-1', name: 'Empty', lastSeen: null };
    const prisma = buildPrisma({ gateway: { findMany: jest.fn().mockResolvedValue([gateway]) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const [result] = await service.listGateways('parent-1');
    expect(result.dohDetectionCount24h).toBe(0);
    expect(prisma.auditLog.count).not.toHaveBeenCalled();
  });
});
