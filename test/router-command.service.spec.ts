import { RouterCommandService } from '../src/router-integration/router-command.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    routerCommand: {
      create: jest.fn().mockResolvedValue({ id: 'cmd-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.routerCommand,
    },
    detectedRouter: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.detectedRouter,
    },
  } as any;
}

function buildEncryption(overrides: any = {}) {
  return {
    encrypt: jest.fn((s: string) => `enc:${s}`),
    decrypt: jest.fn((s: string) => s.replace(/^enc:/, '')),
    ...overrides,
  } as any;
}

describe('RouterCommandService.enqueueCommand', () => {
  it('serializes the payload to JSON and defaults deviceId to null', async () => {
    const prisma = buildPrisma();
    const service = new RouterCommandService(prisma, buildEncryption());

    await service.enqueueCommand('gw-1', 'CHANGE_DNS', { dnsServer: '1.1.1.1' });

    expect(prisma.routerCommand.create).toHaveBeenCalledWith({
      data: {
        gatewayId: 'gw-1',
        deviceId: null,
        type: 'CHANGE_DNS',
        payload: JSON.stringify({ dnsServer: '1.1.1.1' }),
        status: 'PENDING',
      },
    });
  });
});

describe('RouterCommandService.getPendingCommands', () => {
  it('returns an empty array and never calls updateMany when there is nothing pending', async () => {
    const prisma = buildPrisma();
    const service = new RouterCommandService(prisma, buildEncryption());

    const result = await service.getPendingCommands('gw-1');

    expect(result).toEqual([]);
    expect(prisma.routerCommand.updateMany).not.toHaveBeenCalled();
  });

  it('queries PENDING first, then marks exactly those IDs DELIVERED, and returns them (not the empty-poll bug)', async () => {
    const pending = [
      { id: 'cmd-1', gatewayId: 'gw-1', type: 'DISCONNECT_CLIENT', status: 'PENDING' },
      { id: 'cmd-2', gatewayId: 'gw-1', type: 'CHANGE_DNS', status: 'PENDING' },
    ];
    const prisma = buildPrisma({ routerCommand: { findMany: jest.fn().mockResolvedValue(pending) } });
    const service = new RouterCommandService(prisma, buildEncryption());

    const result = await service.getPendingCommands('gw-1');

    expect(prisma.routerCommand.findMany).toHaveBeenCalledWith({
      where: { gatewayId: 'gw-1', status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    expect(prisma.routerCommand.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['cmd-1', 'cmd-2'] } },
      data: { status: 'DELIVERED', deliveredAt: expect.any(Date) },
    });
    // Critically: the commands are actually returned, not an empty list.
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'cmd-1', status: 'DELIVERED' });
    expect(result[1]).toMatchObject({ id: 'cmd-2', status: 'DELIVERED' });
  });
});

describe('RouterCommandService.acknowledgeCommand', () => {
  it('throws when the command does not exist', async () => {
    const prisma = buildPrisma();
    const service = new RouterCommandService(prisma, buildEncryption());

    await expect(service.acknowledgeCommand('gw-1', 'ghost', true)).rejects.toThrow(NotFoundException);
  });

  it('throws when the command belongs to a different gateway', async () => {
    const prisma = buildPrisma({
      routerCommand: { findUnique: jest.fn().mockResolvedValue({ id: 'cmd-1', gatewayId: 'someone-else' }) },
    });
    const service = new RouterCommandService(prisma, buildEncryption());

    await expect(service.acknowledgeCommand('gw-1', 'cmd-1', true)).rejects.toThrow(ForbiddenException);
  });

  it('marks ACKNOWLEDGED on success with serialized resultData', async () => {
    const prisma = buildPrisma({
      routerCommand: { findUnique: jest.fn().mockResolvedValue({ id: 'cmd-1', gatewayId: 'gw-1' }) },
    });
    const service = new RouterCommandService(prisma, buildEncryption());

    await service.acknowledgeCommand('gw-1', 'cmd-1', true, { strategyUsed: 'DISCONNECT_CLIENT' });

    expect(prisma.routerCommand.update).toHaveBeenCalledWith({
      where: { id: 'cmd-1' },
      data: {
        status: 'ACKNOWLEDGED',
        ackedAt: expect.any(Date),
        resultData: JSON.stringify({ strategyUsed: 'DISCONNECT_CLIENT' }),
      },
    });
  });

  it('marks FAILED on failure', async () => {
    const prisma = buildPrisma({
      routerCommand: { findUnique: jest.fn().mockResolvedValue({ id: 'cmd-1', gatewayId: 'gw-1' }) },
    });
    const service = new RouterCommandService(prisma, buildEncryption());

    await service.acknowledgeCommand('gw-1', 'cmd-1', false, { reason: 'connection refused' });

    const updateArg = prisma.routerCommand.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe('FAILED');
  });
});

describe('RouterCommandService.getRouterConnectionInfo', () => {
  it('returns null when no router has been detected for this gateway', async () => {
    const prisma = buildPrisma();
    const service = new RouterCommandService(prisma, buildEncryption());

    expect(await service.getRouterConnectionInfo('gw-1')).toBeNull();
  });

  it('decrypts stored credentials and returns connection info', async () => {
    const encryption = buildEncryption();
    const encrypted = encryption.encrypt(JSON.stringify({ username: 'admin', password: 'hunter2' }));
    const prisma = buildPrisma({
      detectedRouter: {
        findUnique: jest.fn().mockResolvedValue({
          pluginId: 'mikrotik',
          ipAddress: '192.168.1.1',
          hostname: 'router.lan',
          adminCredentialsEncrypted: encrypted,
        }),
      },
    });
    const service = new RouterCommandService(prisma, encryption);

    const result = await service.getRouterConnectionInfo('gw-1');

    expect(result).toEqual({
      pluginId: 'mikrotik',
      ipAddress: '192.168.1.1',
      hostname: 'router.lan',
      credentials: { username: 'admin', password: 'hunter2' },
    });
  });

  it('returns null credentials (never throws) when decryption fails on a corrupt payload', async () => {
    const encryption = buildEncryption({
      decrypt: jest.fn(() => {
        throw new Error('bad ciphertext');
      }),
    });
    const prisma = buildPrisma({
      detectedRouter: {
        findUnique: jest.fn().mockResolvedValue({
          pluginId: 'mikrotik',
          ipAddress: '192.168.1.1',
          hostname: null,
          adminCredentialsEncrypted: 'garbage',
        }),
      },
    });
    const service = new RouterCommandService(prisma, encryption);

    const result = await service.getRouterConnectionInfo('gw-1');
    expect(result?.credentials).toBeNull();
  });

  it('returns null credentials when none are stored yet', async () => {
    const prisma = buildPrisma({
      detectedRouter: {
        findUnique: jest.fn().mockResolvedValue({
          pluginId: 'openwrt',
          ipAddress: '192.168.1.1',
          hostname: null,
          adminCredentialsEncrypted: null,
        }),
      },
    });
    const service = new RouterCommandService(prisma, buildEncryption());

    const result = await service.getRouterConnectionInfo('gw-1');
    expect(result?.credentials).toBeNull();
  });
});
