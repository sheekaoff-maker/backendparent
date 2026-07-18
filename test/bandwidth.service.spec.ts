import { BandwidthService } from '../src/bandwidth/bandwidth.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    device: {
      findUnique: jest.fn().mockResolvedValue({ id: 'dev-1', parentId: 'parent-1' }),
      ...overrides.device,
    },
    child: {
      findUnique: jest.fn().mockResolvedValue({ id: 'child-1', parentId: 'parent-1' }),
      ...overrides.child,
    },
    bandwidthLimit: {
      create: jest.fn().mockResolvedValue({ id: 'bw-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'bw-1', parentId: 'parent-1' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      ...overrides.bandwidthLimit,
    },
  } as any;
}

describe('BandwidthService.create', () => {
  it('rejects when neither childId nor deviceId is given', async () => {
    const service = new BandwidthService(buildPrisma());
    await expect(service.create('parent-1', { downloadKbps: 1000 } as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects when both childId and deviceId are given', async () => {
    const service = new BandwidthService(buildPrisma());
    await expect(
      service.create('parent-1', { childId: 'child-1', deviceId: 'dev-1', downloadKbps: 1000 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when neither downloadKbps nor uploadKbps is given', async () => {
    const service = new BandwidthService(buildPrisma());
    await expect(service.create('parent-1', { deviceId: 'dev-1' } as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects a device that does not belong to this parent', async () => {
    const prisma = buildPrisma({ device: { findUnique: jest.fn().mockResolvedValue({ id: 'dev-1', parentId: 'someone-else' }) } });
    const service = new BandwidthService(prisma);
    await expect(
      service.create('parent-1', { deviceId: 'dev-1', downloadKbps: 1000 } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a device that does not exist', async () => {
    const prisma = buildPrisma({ device: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new BandwidthService(prisma);
    await expect(
      service.create('parent-1', { deviceId: 'ghost', downloadKbps: 1000 } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates a device-scoped limit with a category', async () => {
    const prisma = buildPrisma();
    const service = new BandwidthService(prisma);

    await service.create('parent-1', { deviceId: 'dev-1', category: 'GAMING', downloadKbps: 512, uploadKbps: 256 } as any);

    expect(prisma.bandwidthLimit.create).toHaveBeenCalledWith({
      data: {
        parentId: 'parent-1',
        childId: undefined,
        deviceId: 'dev-1',
        category: 'GAMING',
        downloadKbps: 512,
        uploadKbps: 256,
      },
    });
  });

  it('creates a child-scoped limit after validating child ownership', async () => {
    const prisma = buildPrisma();
    const service = new BandwidthService(prisma);

    await service.create('parent-1', { childId: 'child-1', downloadKbps: 1024 } as any);

    expect(prisma.child.findUnique).toHaveBeenCalledWith({ where: { id: 'child-1' } });
    expect(prisma.bandwidthLimit.create).toHaveBeenCalled();
  });
});

describe('BandwidthService ownership checks', () => {
  it('findOne throws for a limit owned by a different parent', async () => {
    const prisma = buildPrisma({
      bandwidthLimit: { findUnique: jest.fn().mockResolvedValue({ id: 'bw-1', parentId: 'someone-else' }) },
    });
    const service = new BandwidthService(prisma);
    await expect(service.findOne('parent-1', 'bw-1')).rejects.toThrow(ForbiddenException);
  });

  it('update rejects for a limit not owned by this parent', async () => {
    const prisma = buildPrisma({
      bandwidthLimit: {
        findUnique: jest.fn().mockResolvedValue({ id: 'bw-1', parentId: 'someone-else' }),
        update: jest.fn(),
      },
    });
    const service = new BandwidthService(prisma);
    await expect(service.update('parent-1', 'bw-1', { downloadKbps: 500 })).rejects.toThrow(ForbiddenException);
    expect(prisma.bandwidthLimit.update).not.toHaveBeenCalled();
  });
});
