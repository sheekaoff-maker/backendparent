import { EnforcementService } from '../src/enforcement/enforcement.service';

function buildPrisma(device: any) {
  return {
    device: {
      findUnique: jest.fn().mockResolvedValue(device),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

function buildDnsPolicyService() {
  return { invalidateSourceIps: jest.fn().mockResolvedValue(undefined) } as any;
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) } as any;
}

function buildSmartBlockEngine() {
  return {
    syncBlockToRouter: jest.fn().mockResolvedValue({ enqueued: true, commandId: 'cmd-1', strategies: ['PAUSE_DEVICE'], reason: null }),
    syncUnblockToRouter: jest.fn().mockResolvedValue({ enqueued: true, commandId: 'cmd-2', strategies: ['PAUSE_DEVICE'], reason: null }),
  } as any;
}

function buildService(
  prisma: any,
  dnsPolicyService: any,
  adapterResult: { success: boolean } = { success: true },
  audit: any = buildAudit(),
  smartBlockEngine: any = buildSmartBlockEngine(),
) {
  const adapter = {
    blockDevice: jest.fn().mockResolvedValue({ success: adapterResult.success, message: 'ok' }),
    unblockDevice: jest.fn().mockResolvedValue({ success: adapterResult.success, message: 'ok' }),
    stopSession: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    startSession: jest.fn(),
    extendSession: jest.fn(),
    getStatus: jest.fn(),
  };
  // MockAdapter stands in for every ControlMethod here — the test only
  // cares about EnforcementService's own status-write + cache-invalidation
  // wiring, not any individual adapter's real behaviour.
  const service = new EnforcementService(
    prisma,
    adapter as any,
    adapter as any,
    adapter as any,
    adapter as any,
    adapter as any,
    dnsPolicyService,
    audit,
    smartBlockEngine,
  );
  return { service, adapter, audit, smartBlockEngine };
}

const DEVICE = {
  id: 'dev-1',
  parentId: 'parent-1',
  controlMethod: 'MOCK',
  gatewayId: 'gw-1',
  ipAddress: '192.168.1.50',
  dnsSourceIp: '203.0.113.5',
  ipv6Address: '2001:db8::1',
  type: 'PLAYSTATION',
};

describe('EnforcementService — DNS cache invalidation on block/unblock', () => {
  it('invalidates the DNS-policy cache for all three of a device\'s addresses after a successful block', async () => {
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(DEVICE);
    const { service, audit } = buildService(prisma, dnsPolicyService);

    await service.blockDevice('dev-1', 'Parent requested', 'parent-1');

    expect(prisma.device.update).toHaveBeenCalledWith({ where: { id: 'dev-1' }, data: { status: 'BLOCKED' } });
    expect(dnsPolicyService.invalidateSourceIps).toHaveBeenCalledWith(['192.168.1.50', '203.0.113.5', '2001:db8::1']);
    expect(audit.log).toHaveBeenCalledWith({
      userId: 'parent-1',
      action: 'device.block',
      entity: 'device',
      entityId: 'dev-1',
      details: 'Parent requested',
    });
  });

  it('invalidates the DNS-policy cache after a successful unblock', async () => {
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(DEVICE);
    const { service } = buildService(prisma, dnsPolicyService);

    await service.unblockDevice('dev-1');

    expect(prisma.device.update).toHaveBeenCalledWith({ where: { id: 'dev-1' }, data: { status: 'ONLINE' } });
    expect(dnsPolicyService.invalidateSourceIps).toHaveBeenCalledWith(['192.168.1.50', '203.0.113.5', '2001:db8::1']);
  });

  it('does not touch the DB or DNS cache when the adapter reports failure', async () => {
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(DEVICE);
    const { service } = buildService(prisma, dnsPolicyService, { success: false });

    await service.blockDevice('dev-1', 'Parent requested');

    expect(prisma.device.update).not.toHaveBeenCalled();
    expect(dnsPolicyService.invalidateSourceIps).not.toHaveBeenCalled();
  });

  it('handleOfflineViolation for an offline-unsupported device (e.g. PlayStation) also invalidates the DNS cache', async () => {
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(DEVICE);
    const { service, adapter } = buildService(prisma, dnsPolicyService);

    await service.handleOfflineViolation(DEVICE as any, 'session-1');

    expect(adapter.stopSession).toHaveBeenCalledWith(DEVICE);
    expect(prisma.device.update).toHaveBeenCalledWith({ where: { id: 'dev-1' }, data: { status: 'BLOCKED' } });
    expect(dnsPolicyService.invalidateSourceIps).toHaveBeenCalledWith(['192.168.1.50', '203.0.113.5', '2001:db8::1']);
  });

  it('handleOfflineViolation for an offline-unsupported device with no gateway assigned does not block or touch the DNS cache', async () => {
    const deviceNoGateway = { ...DEVICE, gatewayId: null };
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(deviceNoGateway);
    const { service } = buildService(prisma, dnsPolicyService);

    await service.handleOfflineViolation(deviceNoGateway as any, 'session-1');

    expect(prisma.device.update).not.toHaveBeenCalled();
    expect(dnsPolicyService.invalidateSourceIps).not.toHaveBeenCalled();
  });

  it('handleOfflineViolation for a device that CAN be killed directly (e.g. Android) blocks via the normal path', async () => {
    const androidDevice = { ...DEVICE, type: 'ANDROID_PHONE' };
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(androidDevice);
    const { service } = buildService(prisma, dnsPolicyService);

    await service.handleOfflineViolation(androidDevice as any, 'session-1');

    expect(prisma.device.update).toHaveBeenCalledWith({ where: { id: 'dev-1' }, data: { status: 'BLOCKED' } });
    expect(dnsPolicyService.invalidateSourceIps).toHaveBeenCalled();
  });
});

describe('EnforcementService — explicit router-command sync on block/unblock', () => {
  it('enqueues a BLOCK_DEVICE router command and returns the confirmation in result.data.routerSync', async () => {
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(DEVICE);
    const smartBlockEngine = buildSmartBlockEngine();
    const { service } = buildService(prisma, dnsPolicyService, { success: true }, buildAudit(), smartBlockEngine);

    const result = await service.blockDevice('dev-1', 'Parent requested', 'parent-1');

    expect(smartBlockEngine.syncBlockToRouter).toHaveBeenCalledWith('gw-1', 'dev-1');
    expect(result.data?.routerSync).toEqual({
      attempted: true,
      enqueued: true,
      commandId: 'cmd-1',
      strategies: ['PAUSE_DEVICE'],
      reason: null,
    });
  });

  it('enqueues an UNBLOCK_DEVICE router command on unblock', async () => {
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(DEVICE);
    const smartBlockEngine = buildSmartBlockEngine();
    const { service } = buildService(prisma, dnsPolicyService, { success: true }, buildAudit(), smartBlockEngine);

    const result = await service.unblockDevice('dev-1');

    expect(smartBlockEngine.syncUnblockToRouter).toHaveBeenCalledWith('gw-1', 'dev-1');
    expect(result.data?.routerSync).toEqual({
      attempted: true,
      enqueued: true,
      commandId: 'cmd-2',
      strategies: ['PAUSE_DEVICE'],
      reason: null,
    });
  });

  it('does not attempt a router sync for a device with no gatewayId, and does not fail the overall call', async () => {
    const deviceNoGateway = { ...DEVICE, gatewayId: null };
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(deviceNoGateway);
    const smartBlockEngine = buildSmartBlockEngine();
    const { service } = buildService(prisma, dnsPolicyService, { success: true }, buildAudit(), smartBlockEngine);

    const result = await service.blockDevice('dev-1', 'Parent requested', 'parent-1');

    expect(smartBlockEngine.syncBlockToRouter).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data?.routerSync).toEqual({ attempted: false, enqueued: false, commandId: null, strategies: [], reason: 'device has no gateway' });
  });

  it('does not fail the overall block when the router sync itself throws', async () => {
    const dnsPolicyService = buildDnsPolicyService();
    const prisma = buildPrisma(DEVICE);
    const smartBlockEngine = { syncBlockToRouter: jest.fn().mockRejectedValue(new Error('router command queue unavailable')) };
    const { service } = buildService(prisma, dnsPolicyService, { success: true }, buildAudit(), smartBlockEngine);

    const result = await service.blockDevice('dev-1', 'Parent requested', 'parent-1');

    expect(result.success).toBe(true);
    expect(result.data?.routerSync).toEqual({
      attempted: true,
      enqueued: false,
      commandId: null,
      strategies: [],
      reason: 'router command queue unavailable',
    });
  });
});
