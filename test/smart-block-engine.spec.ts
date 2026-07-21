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

function buildAudit(overrides: any = {}) {
  return {
    log: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as any;
}

describe('SmartBlockEngineService.endGamingSession', () => {
  const capabilityEngine = new CapabilityEngineService(new RouterDatabaseService());

  it('throws when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), buildAudit());

    await expect(service.endGamingSession('parent-1', 'missing-gw', 'dev-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when the gateway belongs to a different parent', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'someone-else' }) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), buildAudit());

    await expect(service.endGamingSession('parent-1', 'gw-1', 'dev-1')).rejects.toThrow(ForbiddenException);
  });

  it('builds the full priority-ordered strategy list for a fully-capable router (mikrotik)', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService, buildAudit());

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
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), buildAudit());

    const result = await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    expect(result.strategies).toEqual(['PAUSE_DEVICE', 'APPLY_FIREWALL_RULE', 'BLOCK_MAC', 'CHANGE_DNS']);
    expect(result.strategies).not.toContain('DISCONNECT_CLIENT');
  });

  it('returns enqueued:false with a Guide-Only reason when the detected router has no supported strategy', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'netgear' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService, buildAudit());

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
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), buildAudit());

    const result = await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    expect(result.enqueued).toBe(false);
    expect(result.reason).toBe('No router has been detected on this gateway yet.');
  });
});

describe('SmartBlockEngineService.syncBlockToRouter / syncUnblockToRouter', () => {
  const capabilityEngine = new CapabilityEngineService(new RouterDatabaseService());

  it('does not require gateway ownership verification — no parentId param, unlike endGamingSession (called internally by EnforcementService, which already authorized the request)', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), buildAudit());

    await expect(service.syncBlockToRouter('gw-1', 'dev-1')).resolves.toBeDefined();
    expect(prisma.gateway.findUnique).not.toHaveBeenCalled();
  });

  it('builds a persistent-block strategy list that excludes DISCONNECT_CLIENT (transient) and CHANGE_DNS (router-wide, not device-scoped)', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService, buildAudit());

    const result = await service.syncBlockToRouter('gw-1', 'dev-1');

    expect(result.strategies).toEqual(['PAUSE_DEVICE', 'APPLY_FIREWALL_RULE', 'BLOCK_MAC']);
    expect(result.strategies).not.toContain('DISCONNECT_CLIENT');
    expect(result.strategies).not.toContain('CHANGE_DNS');
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'BLOCK_DEVICE', { deviceId: 'dev-1', strategies: result.strategies }, 'dev-1');
  });

  it('enqueues UNBLOCK_DEVICE with the same strategy list shape', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService, buildAudit());

    const result = await service.syncUnblockToRouter('gw-1', 'dev-1');

    expect(result.strategies).toEqual(['PAUSE_DEVICE', 'APPLY_FIREWALL_RULE', 'BLOCK_MAC']);
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'UNBLOCK_DEVICE', { deviceId: 'dev-1', strategies: result.strategies }, 'dev-1');
  });

  it('returns enqueued:false with a Guide-Only reason for a router with no supported per-device strategy', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'netgear' }) } });
    const routerCommandService = buildRouterCommandService();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, routerCommandService, buildAudit());

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
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), buildAudit());

    const result = await service.syncBlockToRouter('gw-1', 'dev-1');

    expect(result.enqueued).toBe(false);
    expect(result.reason).toBe('No router has been detected on this gateway yet.');
  });
});

describe('SmartBlockEngineService capability fallback audit trail', () => {
  const capabilityEngine = new CapabilityEngineService(new RouterDatabaseService());

  it('logs every attempted capability (supported and unavailable) plus the chosen one, on a successful fallback', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'fritzbox' }) } });
    const audit = buildAudit();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), audit);

    await service.syncBlockToRouter('gw-1', 'dev-1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const entry = audit.log.mock.calls[0][0];
    expect(entry.action).toBe('enforcement_engine.capability_fallback');
    expect(entry.entity).toBe('device');
    expect(entry.entityId).toBe('dev-1');

    const details = JSON.parse(entry.details);
    expect(details.gatewayId).toBe('gw-1');
    expect(details.requestedAction).toBe('BLOCK_DEVICE');
    expect(details.outcome).toBe('EXECUTED');
    expect(details.chosen).toBe('PAUSE_DEVICE'); // fritzbox: pause is first-priority and supported
    expect(details.attempts).toEqual([
      'PAUSE_DEVICE:supported',
      'APPLY_FIREWALL_RULE:supported',
      'BLOCK_MAC:supported',
    ]);
  });

  it('logs an UNSUPPORTED outcome (with every attempt marked unavailable) rather than throwing, for a Guide-Only router', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'netgear' }) } });
    const audit = buildAudit();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), audit);

    await expect(service.syncBlockToRouter('gw-1', 'dev-1')).resolves.toEqual(
      expect.objectContaining({ enqueued: false }),
    );

    const details = JSON.parse(audit.log.mock.calls[0][0].details);
    expect(details.outcome).toBe('UNSUPPORTED');
    expect(details.chosen).toBeNull();
    expect(details.attempts.every((a: string) => a.endsWith(':unavailable'))).toBe(true);
    expect(details.reason).toMatch(/Guide Only/);
  });

  it('logs an UNSUPPORTED outcome for an undetected router too, with the undetected-specific reason', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue(null) } });
    const audit = buildAudit();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), audit);

    await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    const details = JSON.parse(audit.log.mock.calls[0][0].details);
    expect(details.outcome).toBe('UNSUPPORTED');
    expect(details.reason).toBe('No router has been detected on this gateway yet.');
  });

  it('records the full 5-strategy priority order for endGamingSession on a fully-capable router', async () => {
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const audit = buildAudit();
    const service = new SmartBlockEngineService(prisma, capabilityEngine, buildRouterCommandService(), audit);

    await service.endGamingSession('parent-1', 'gw-1', 'dev-1');

    const details = JSON.parse(audit.log.mock.calls[0][0].details);
    expect(details.requestedAction).toBe('END_GAMING_SESSION');
    expect(details.chosen).toBe('DISCONNECT_CLIENT');
    expect(details.attempts).toHaveLength(5);
  });
});
