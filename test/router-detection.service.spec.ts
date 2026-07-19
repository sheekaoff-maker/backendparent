import { RouterDetectionService } from '../src/router-integration/router-detection.service';
import { RouterDatabaseService } from '../src/router-integration/router-database.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'parent-1' }),
      ...overrides.gateway,
    },
    detectedRouter: {
      upsert: jest.fn().mockResolvedValue({ id: 'router-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'router-1', gatewayId: 'gw-1' }),
      ...overrides.detectedRouter,
    },
  } as any;
}

describe('RouterDetectionService.recordDetection', () => {
  it('throws when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    await expect(service.recordDetection('missing-gw', { vendor: 'MikroTik' })).rejects.toThrow(NotFoundException);
  });

  it('resolves a recognized vendor to its pluginId and integrationStatus', async () => {
    const prisma = buildPrisma();
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    await service.recordDetection('gw-1', { vendor: 'AVM FRITZ!Box 7590', model: '7590', confidence: 90 });

    const createArg = prisma.detectedRouter.upsert.mock.calls[0][0].create;
    expect(createArg.pluginId).toBe('fritzbox');
    expect(createArg.integrationStatus).toBe('OFFICIAL_API');
    expect(createArg.vendor).toBe('AVM FRITZ!Box 7590');
    expect(createArg.lastDetectedAt).toBeInstanceOf(Date);
  });

  it('marks integrationStatus GUIDE_ONLY for a recognized-but-unsupported vendor', async () => {
    const prisma = buildPrisma();
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    await service.recordDetection('gw-1', { vendor: 'NETGEAR Nighthawk' });

    const createArg = prisma.detectedRouter.upsert.mock.calls[0][0].create;
    expect(createArg.pluginId).toBe('netgear');
    expect(createArg.integrationStatus).toBe('GUIDE_ONLY');
  });

  it('marks integrationStatus UNDETECTED (pluginId null) for an unrecognized vendor string', async () => {
    const prisma = buildPrisma();
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    await service.recordDetection('gw-1', { vendor: 'Some Obscure Brand' });

    const createArg = prisma.detectedRouter.upsert.mock.calls[0][0].create;
    expect(createArg.pluginId).toBeNull();
    expect(createArg.integrationStatus).toBe('UNDETECTED');
  });

  it('marks integrationStatus UNDETECTED when no vendor string is reported at all', async () => {
    const prisma = buildPrisma();
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    await service.recordDetection('gw-1', {});

    const createArg = prisma.detectedRouter.upsert.mock.calls[0][0].create;
    expect(createArg.pluginId).toBeNull();
    expect(createArg.integrationStatus).toBe('UNDETECTED');
  });
});

describe('RouterDetectionService.getDetectedRouter', () => {
  it('throws NotFoundException when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    await expect(service.getDetectedRouter('parent-1', 'missing-gw')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when the gateway belongs to a different parent', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'someone-else' }) } });
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    await expect(service.getDetectedRouter('parent-1', 'gw-1')).rejects.toThrow(ForbiddenException);
  });

  it('returns the detected router for the owning parent', async () => {
    const prisma = buildPrisma();
    const service = new RouterDetectionService(prisma, new RouterDatabaseService());

    const result = await service.getDetectedRouter('parent-1', 'gw-1');
    expect(result).toEqual({ id: 'router-1', gatewayId: 'gw-1' });
  });
});
