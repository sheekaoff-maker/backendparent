import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsageLogsService } from '../src/usage-logs/usage-logs.service';

function buildPrisma(overrides: any = {}) {
  return {
    child: { findUnique: jest.fn().mockResolvedValue(null), ...overrides.child },
    device: { findUnique: jest.fn().mockResolvedValue(null), ...overrides.device },
    usageLog: { findMany: jest.fn().mockResolvedValue([]), ...overrides.usageLog },
  } as any;
}

describe('UsageLogsService — input validation (regression: /usage/daily 500)', () => {
  it('throws 400 (not 500) when childId is missing on getDailyUsage', async () => {
    const prisma = buildPrisma();
    const service = new UsageLogsService(prisma);

    await expect(service.getDailyUsage('parent-1', undefined as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Must reject BEFORE hitting Prisma — findUnique({id: undefined}) is what threw the 500.
    expect(prisma.child.findUnique).not.toHaveBeenCalled();
  });

  it('throws 400 when childId is an empty string on getWeeklyUsage', async () => {
    const prisma = buildPrisma();
    const service = new UsageLogsService(prisma);

    await expect(service.getWeeklyUsage('parent-1', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.child.findUnique).not.toHaveBeenCalled();
  });

  it('throws 400 when deviceId is missing on getDeviceUsage', async () => {
    const prisma = buildPrisma();
    const service = new UsageLogsService(prisma);

    await expect(service.getDeviceUsage('parent-1', undefined as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.device.findUnique).not.toHaveBeenCalled();
  });

  it('still 404s for an unknown child (validation does not mask real ownership checks)', async () => {
    const prisma = buildPrisma();
    const service = new UsageLogsService(prisma);

    await expect(service.getDailyUsage('parent-1', 'ghost-child')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('still 403s for a child owned by another parent', async () => {
    const prisma = buildPrisma({
      child: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', parentId: 'someone-else' }) },
    });
    const service = new UsageLogsService(prisma);

    await expect(service.getDailyUsage('parent-1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns an empty daily summary for a real, owned child with no logs', async () => {
    const prisma = buildPrisma({
      child: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', parentId: 'parent-1' }) },
    });
    const service = new UsageLogsService(prisma);

    const result = await service.getDailyUsage('parent-1', 'c1');
    expect(result).toMatchObject({ childId: 'c1', totalMinutes: 0, totalSeconds: 0, logCount: 0 });
  });
});
