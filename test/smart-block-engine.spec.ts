import { SmartBlockEngineService } from '../src/router-integration/smart-block-engine.service';
import { CapabilityEngineService } from '../src/router-integration/capability-engine.service';
import { RouterDatabaseService } from '../src/router-integration/router-database.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'parent-1' }),
      ...overrides.gateway,
    },
    detectedRouter: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.detectedRouter,
    },
  } as any;
}

function buildRouterCommandService(overrides: any = {}) {
  return {
    enqueueCommand: jest.fn().mockResolvedValue({ id: 'cmd-1' }),
    ...overrides,
  } as any;
}

describe('SmartBlockEngineService.endGamingSession', () => {
  const capabilityEngine = new CapabilityEngineService(new RouterDatabaseService());

  it('throws when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService());

    await expect(service.endGamingSession('parent-1', 'missing-gw', 'dev-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when the gateway belongs to a different parent', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'someone-else' }) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService());

    await expect(service.endGamingSession('parent-1', 'gw-1', 'dev-1')).rejects.toThrow(ForbiddenException);
  });

  it('builds the full priority-ordered strategy list for a fully-capable router (mikrotik)', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService);

    const result = await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    // MikroTik supports disconnect, pause(firewall-block), firewall rules,
    // MAC filtering, and DNS change — every strategy should be offered in
    // priority order.
    expect(result.enqueued).toBe(true);
    expect(result.strategies).toEqual([
      'DISCONNECT_CLIENT',
      'PAUSE_DEVICE',
      'APPLY_FIREWALL_RULE',
      'BLOCK_MAC',
      'CHANGE_DNS',
    ]);
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith(
      'gw-1',
      'END_GAMING_SESSION',
      { deviceId: 'dev-1', strategies: result.strategies },
      'dev-1',
    );
  });

  it('omits unsupported strategies for a router with partial capabilities (fritzbox: no client-disconnect, no QoS)', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'fritzbox' }) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService());

    const result = await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    expect(result.strategies).toEqual(['PAUSE_DEVICE', 'APPLY_FIREWALL_RULE', 'BLOCK_MAC', 'CHANGE_DNS']);
    expect(result.strategies).not.toContain('DISCONNECT_CLIENT');
  });

  it('returns enqueued:false with a Guide-Only reason when the detected router has no supported strategy', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'netgear' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService);

    const result = await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    expect(result).toEqual({
      enqueued: false,
      commandId: null,
      strategies: [],
      reason: 'This router has no supported control strategy (Guide Only) — see Supported Features for manual instructions.',
    });
    expect(routerCommandService.enqueueCommand).not.toHaveBeenCalled();
  });

  it('returns enqueued:false with an undetected-router reason when no router has been detected at all', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService());

    const result = await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    expect(result.enqueued).toBe(false);
    expect(result.reason).toBe('No router has been detected on this gateway yet.');
  });
});

describe('SmartBlockEngineService.syncBlockToRouter / syncUnblockToRouter', () => {
  const capabilityEngine = new CapabilityEngineService(new RouterDatabaseService());

  it('does not require gateway ownership verification — no parentId param, unlike endGamingSession (called internally by EnforcementService, which already authorized the request)', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService());

    await expect(service.syncBlockToRouter('gw-1', 'dev-1')).resolves.toBeDefined();
    expect(prisma.gateway.findUnique).not.toHaveBeenCalled();
  });

  it('builds a persistent-block strategy list that excludes DISCONNECT_CLIENT (transient) and CHANGE_DNS (router-wide, not device-scoped)', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService);

    const result = await service.syncBlockToRouter('gw-1', 'dev-1');

    expect(result.strategies).toEqual(['PAUSE_DEVICE', 'APPLY_FIREWALL_RULE', 'BLOCK_MAC']);
    expect(result.strategies).not.toContain('DISCONNECT_CLIENT');
    expect(result.strategies).not.toContain('CHANGE_DNS');
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'BLOCK_DEVICE', { deviceId: 'dev-1', strategies: result.strategies }, 'dev-1');
  });

  it('enqueues UNBLOCK_DEVICE with the same strategy list shape', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService);

    const result = await service.syncUnblockToRouter('gw-1', 'dev-1');

    expect(result.strategies).toEqual(['PAUSE_DEVICE', 'APPLY_FIREWALL_RULE', 'BLOCK_MAC']);
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'UNBLOCK_DEVICE', { deviceId: 'dev-1', strategies: result.strategies }, 'dev-1');
  });

  it('returns enqueued:false with a Guide-Only reason for a router with no supported per-device strategy', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'netgear' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService);

    const result = await service.syncBlockToRouter('gw-1', 'dev-1');

    expect(result).toEqual({
      enqueued: false,
      commandId: null,
      strategies: [],
      reason: 'This router has no supported control strategy (Guide Only) — see Supported Features for manual instructions.',
    });
    expect(routerCommandService.enqueueCommand).not.toHaveBeenCalled();
  });

  it('returns enqueued:false with an undetected-router reason when no router has been detected at all', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService());

    const result = await service.syncBlockToRouter('gw-1', 'dev-1');

    expect(result.enqueued).toBe(false);
    expect(result.reason).toBe('No router has been detected on this gateway yet.');
  });
});
