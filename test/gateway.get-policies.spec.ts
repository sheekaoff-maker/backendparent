import { GatewayService } from '../src/gateway/gateway.service';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', devices: [] }),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.gateway,
    },
    bandwidthLimit: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.bandwidthLimit,
    },
  } as any;
}

function device(overrides: any = {}) {
  return {
    id: 'dev-1',
    name: 'Phone',
    macAddress: 'aa:bb:cc:dd:ee:ff',
    ipAddress: '192.168.1.50',
    dnsSourceIp: '192.168.1.50',
    status: 'ONLINE',
    internetLocked: false,
    internetLockedReason: null,
    internetLockedAt: null,
    blockingMode: 'GAMING_ONLY',
    updatedAt: new Date(),
    vpnBlockEnabled: true,
    quicBlockEnabled: false,
    childId: 'child-1',
    ...overrides,
  };
}

describe('GatewayService.getPolicies agent version reporting', () => {
  it('stamps lastSeen and the reported agentVersion on the gateway row', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', devices: [] }) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await service.getPolicies('gw-1', false, '1.2.3');

    expect(prisma.gateway.update).toHaveBeenCalledWith({
      where: { id: 'gw-1' },
      data: expect.objectContaining({ agentVersion: '1.2.3' }),
    });
  });

  it('does not overwrite agentVersion when the request omits the header (older agent build)', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', devices: [] }) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await service.getPolicies('gw-1');

    const updateArg = prisma.gateway.update.mock.calls[0][0];
    expect(updateArg.data.agentVersion).toBeUndefined();
  });
});

describe('GatewayService.getPolicies bandwidth resolution (Layer 7)', () => {
  it('returns an empty bandwidthLimits array when none apply', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', devices: [device()] }) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.getPolicies('gw-1');

    expect(result.devices[0].bandwidthLimits).toEqual([]);
  });

  it('includes a device-level default limit (no category)', async () => {
    const prisma = buildPrisma({
      gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', devices: [device()] }) },
      bandwidthLimit: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ deviceId: 'dev-1', childId: null, category: null, downloadKbps: 5000, uploadKbps: 2000 }]),
      },
    });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.getPolicies('gw-1');

    expect(result.devices[0].bandwidthLimits).toEqual([{ category: null, downloadKbps: 5000, uploadKbps: 2000 }]);
  });

  it('applies a child-scoped category limit to every device of that child', async () => {
    const prisma = buildPrisma({
      gateway: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gw-1',
          devices: [device({ id: 'dev-1', childId: 'child-1' }), device({ id: 'dev-2', childId: 'child-1' })],
        }),
      },
      bandwidthLimit: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ deviceId: null, childId: 'child-1', category: 'GAMING', downloadKbps: 512, uploadKbps: 512 }]),
      },
    });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.getPolicies('gw-1');

    expect(result.devices[0].bandwidthLimits).toEqual([{ category: 'GAMING', downloadKbps: 512, uploadKbps: 512 }]);
    expect(result.devices[1].bandwidthLimits).toEqual([{ category: 'GAMING', downloadKbps: 512, uploadKbps: 512 }]);
  });

  it('lets a device-specific limit for the same category override the child-scoped one', async () => {
    const prisma = buildPrisma({
      gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', devices: [device({ id: 'dev-1', childId: 'child-1' })] }) },
      bandwidthLimit: {
        findMany: jest.fn().mockResolvedValue([
          { deviceId: null, childId: 'child-1', category: 'STREAMING', downloadKbps: 1000, uploadKbps: 1000 },
          { deviceId: 'dev-1', childId: null, category: 'STREAMING', downloadKbps: 200, uploadKbps: 200 },
        ]),
      },
    });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.getPolicies('gw-1');

    expect(result.devices[0].bandwidthLimits).toEqual([{ category: 'STREAMING', downloadKbps: 200, uploadKbps: 200 }]);
  });

  it('does not leak a child-scoped limit onto a device belonging to a different (or no) child', async () => {
    const prisma = buildPrisma({
      gateway: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'gw-1',
          devices: [device({ id: 'dev-2', childId: null })],
        }),
      },
      bandwidthLimit: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.getPolicies('gw-1');

    // childId is null, so loadBandwidthLimits must not query with {childId: null}
    // (which would incorrectly match rows with a null childId belonging to
    // other devices' device-scoped rules).
    expect(prisma.bandwidthLimit.findMany).toHaveBeenCalledWith({
      where: { enabled: true, OR: [{ deviceId: { in: ['dev-2'] } }] },
    });
    expect(result.devices[0].bandwidthLimits).toEqual([]);
  });
});

describe('GatewayService.getPolicies — self-healing token rotation', () => {
  it('omits rotatedToken on a normal request (authenticated via the current token)', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', token: 'new-tok', devices: [] }) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.getPolicies('gw-1');

    expect(result.rotatedToken).toBeUndefined();
  });

  it('includes the current token as rotatedToken when the request was authenticated via the previous token', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', token: 'new-tok', devices: [] }) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.getPolicies('gw-1', true);

    expect(result.rotatedToken).toBe('new-tok');
  });
});
