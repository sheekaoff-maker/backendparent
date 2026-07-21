import { GatewayService } from '../src/gateway/gateway.service';
import { GatewayType } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'parent-1' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      ...overrides.gateway,
    },
    device: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...overrides.device,
    },
    detectedRouter: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...overrides.detectedRouter,
    },
    routerCommand: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...overrides.routerCommand,
    },
    vpnDetectionLog: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...overrides.vpnDetectionLog,
    },
    $transaction: jest.fn((ops: Promise<any>[]) => Promise.all(ops)),
  } as any;
}

describe('GatewayService.register', () => {
  it('creates the gateway already paired — nothing else in this codebase ever calls pair() automatically, and GatewayTokenGuard hard-rejects unpaired gateways', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await service.register('parent-1', 'Home Gateway');

    const createArg = prisma.gateway.create.mock.calls[0][0];
    expect(createArg.data.paired).toBe(true);
    expect(createArg.data.pairedAt).toBeInstanceOf(Date);
    expect(createArg.data.parentId).toBe('parent-1');
    expect(createArg.data.name).toBe('Home Gateway');
    expect(typeof createArg.data.token).toBe('string');
    expect(createArg.data.token.length).toBeGreaterThan(0);
  });

  it('defaults gatewayType to SOFTWARE_AGENT when not specified', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await service.register('parent-1', 'Home Gateway');

    expect(prisma.gateway.create.mock.calls[0][0].data.gatewayType).toBe(GatewayType.SOFTWARE_AGENT);
  });

  it('passes through an explicit ROUTER_PLUGIN gatewayType and description', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await service.register('parent-1', 'Office Router', 'https://router.local', GatewayType.ROUTER_PLUGIN, 'MikroTik in the office');

    const data = prisma.gateway.create.mock.calls[0][0].data;
    expect(data.gatewayType).toBe(GatewayType.ROUTER_PLUGIN);
    expect(data.description).toBe('MikroTik in the office');
    expect(data.endpoint).toBe('https://router.local');
  });
});

describe('GatewayService.renameGateway', () => {
  it('updates only the provided fields', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await service.renameGateway('parent-1', 'gw-1', 'New Name');

    expect(prisma.gateway.update).toHaveBeenCalledWith({
      where: { id: 'gw-1' },
      data: { name: 'New Name' },
    });
  });

  it('throws NotFoundException for a missing gateway', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await expect(service.renameGateway('parent-1', 'missing', 'x')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException for a gateway owned by another parent', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'someone-else' }) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await expect(service.renameGateway('parent-1', 'gw-1', 'x')).rejects.toThrow(ForbiddenException);
  });
});

describe('GatewayService.deleteGateway', () => {
  it('detaches devices (gatewayId -> null) rather than deleting them, and cleans up gateway-scoped rows', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    const result = await service.deleteGateway('parent-1', 'gw-1');

    expect(prisma.device.updateMany).toHaveBeenCalledWith({ where: { gatewayId: 'gw-1' }, data: { gatewayId: null } });
    expect(prisma.detectedRouter.deleteMany).toHaveBeenCalledWith({ where: { gatewayId: 'gw-1' } });
    expect(prisma.routerCommand.deleteMany).toHaveBeenCalledWith({ where: { gatewayId: 'gw-1' } });
    expect(prisma.vpnDetectionLog.deleteMany).toHaveBeenCalledWith({ where: { gatewayId: 'gw-1' } });
    expect(prisma.gateway.delete).toHaveBeenCalledWith({ where: { id: 'gw-1' } });
    expect(result).toEqual({ deleted: true });
  });

  it('throws ForbiddenException for a gateway owned by another parent, without deleting anything', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'someone-else' }) } });
    const service = new GatewayService(prisma, { log: jest.fn() } as any);

    await expect(service.deleteGateway('parent-1', 'gw-1')).rejects.toThrow(ForbiddenException);
    expect(prisma.gateway.delete).not.toHaveBeenCalled();
  });
});
