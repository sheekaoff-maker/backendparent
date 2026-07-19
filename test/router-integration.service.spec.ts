import { RouterIntegrationService } from '../src/router-integration/router-integration.service';
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
      upsert: jest.fn().mockResolvedValue({}),
      ...overrides.detectedRouter,
    },
  } as any;
}

function buildEncryption() {
  return {
    encrypt: jest.fn((s: string) => `enc:${s}`),
    decrypt: jest.fn((s: string) => s.replace(/^enc:/, '')),
  } as any;
}

function buildRouterCommandService(overrides: any = {}) {
  return {
    enqueueCommand: jest.fn().mockResolvedValue({ id: 'cmd-1' }),
    listRecentCommands: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
}

function buildService(overrides: any = {}) {
  const prisma = overrides.prisma ?? buildPrisma();
  const encryption = overrides.encryption ?? buildEncryption();
  const capabilityEngine = overrides.capabilityEngine ?? new CapabilityEngineService(new RouterDatabaseService());
  const routerCommandService = overrides.routerCommandService ?? buildRouterCommandService();
  return {
    service: new RouterIntegrationService(prisma, encryption, capabilityEngine, routerCommandService),
    prisma,
    encryption,
    routerCommandService,
  };
}

describe('RouterIntegrationService ownership checks', () => {
  it('getFeatures throws NotFoundException for a missing gateway', async () => {
    const { service } = buildService({ prisma: buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } }) });
    await expect(service.getFeatures('parent-1', 'gw-1')).rejects.toThrow(NotFoundException);
  });

  it('getFeatures throws ForbiddenException for a gateway owned by someone else', async () => {
    const { service } = buildService({
      prisma: buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'someone-else' }) } }),
    });
    await expect(service.getFeatures('parent-1', 'gw-1')).rejects.toThrow(ForbiddenException);
  });
});

describe('RouterIntegrationService.getFeatures', () => {
  it('reports detected:false when no router (or no pluginId) is on record', async () => {
    const { service } = buildService();
    expect(await service.getFeatures('parent-1', 'gw-1')).toEqual({ detected: false, capabilities: null });
  });

  it('reports the capability entry for a detected, recognized router', async () => {
    const { service } = buildService({
      prisma: buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'openwrt' }) } }),
    });
    const result = await service.getFeatures('parent-1', 'gw-1');
    expect(result.detected).toBe(true);
    expect(result.capabilities?.protocol).toBe('ubus-JSONRPC');
  });
});

describe('RouterIntegrationService.setup', () => {
  it('encrypts the submitted credentials and enqueues a TEST_CONNECTION command', async () => {
    const { service, prisma, encryption, routerCommandService } = buildService();

    const result = await service.setup('parent-1', 'gw-1', { username: 'admin', password: 'hunter2', vendorPluginId: 'mikrotik' });

    expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify({ username: 'admin', password: 'hunter2', apiKey: undefined }));
    const upsertArg = prisma.detectedRouter.upsert.mock.calls[0][0];
    expect(upsertArg.create.pluginId).toBe('mikrotik');
    expect(upsertArg.create.integrationStatus).toBe('OFFICIAL_API');
    expect(upsertArg.create.adminCredentialsEncrypted).toMatch(/^enc:/);
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'TEST_CONNECTION', {});
    expect(result).toEqual({ saved: true, testCommandId: 'cmd-1' });
  });

  it('does not touch pluginId/integrationStatus when no vendorPluginId is given (credential update only)', async () => {
    const { service, prisma } = buildService();

    await service.setup('parent-1', 'gw-1', { username: 'admin', password: 'newpass' });

    const upsertArg = prisma.detectedRouter.upsert.mock.calls[0][0];
    expect(upsertArg.update).not.toHaveProperty('pluginId');
    expect(upsertArg.update).not.toHaveProperty('integrationStatus');
    expect(upsertArg.update.adminCredentialsEncrypted).toMatch(/^enc:/);
  });
});

describe('RouterIntegrationService action methods enqueue the right command type', () => {
  it('changeDns enqueues CHANGE_DNS with the dns server', async () => {
    const { service, routerCommandService } = buildService();
    await service.changeDns('parent-1', 'gw-1', '1.1.1.1');
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'CHANGE_DNS', { dnsServer: '1.1.1.1' });
  });

  it('blockMac enqueues BLOCK_MAC with the mac address', async () => {
    const { service, routerCommandService } = buildService();
    await service.blockMac('parent-1', 'gw-1', 'AA:BB:CC:DD:EE:FF');
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'BLOCK_MAC', { macAddress: 'AA:BB:CC:DD:EE:FF' });
  });

  it('unblockMac enqueues UNBLOCK_MAC with the mac address', async () => {
    const { service, routerCommandService } = buildService();
    await service.unblockMac('parent-1', 'gw-1', 'AA:BB:CC:DD:EE:FF');
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'UNBLOCK_MAC', { macAddress: 'AA:BB:CC:DD:EE:FF' });
  });

  it('testConnection enqueues a bare TEST_CONNECTION command', async () => {
    const { service, routerCommandService } = buildService();
    await service.testConnection('parent-1', 'gw-1');
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'TEST_CONNECTION', {});
  });

  it('triggerDetection enqueues a bare DETECT command', async () => {
    const { service, routerCommandService } = buildService();
    const result = await service.triggerDetection('parent-1', 'gw-1');
    expect(routerCommandService.enqueueCommand).toHaveBeenCalledWith('gw-1', 'DETECT', {});
    expect(result).toEqual({ detectCommandId: 'cmd-1' });
  });

  it('getDiagnostics returns both the detected router and recent commands', async () => {
    const routerCommandService = buildRouterCommandService({ listRecentCommands: jest.fn().mockResolvedValue([{ id: 'cmd-1' }]) });
    const prisma = buildPrisma({ detectedRouter: { findUnique: jest.fn().mockResolvedValue({ pluginId: 'mikrotik' }) } });
    const { service } = buildService({ prisma, routerCommandService });

    const result = await service.getDiagnostics('parent-1', 'gw-1');
    expect(result.router).toEqual({ pluginId: 'mikrotik' });
    expect(result.recentCommands).toEqual([{ id: 'cmd-1' }]);
  });
});
