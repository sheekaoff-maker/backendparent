import { GatewayService } from '../src/gateway/gateway.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'parent-1', token: 'old-tok' }),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'gw-1', ...data })),
      ...overrides.gateway,
    },
  } as any;
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('GatewayService.rotateToken', () => {
  it('throws when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new GatewayService(prisma, buildAudit());

    await expect(service.rotateToken('parent-1', 'missing-gw')).rejects.toThrow(NotFoundException);
  });

  it('throws when the gateway belongs to a different parent', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1', parentId: 'someone-else', token: 'old-tok' }) } });
    const service = new GatewayService(prisma, buildAudit());

    await expect(service.rotateToken('parent-1', 'gw-1')).rejects.toThrow(ForbiddenException);
  });

  it('generates a new token, moves the old one into previousToken with a future expiry, and returns the new token', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, buildAudit());

    const result = await service.rotateToken('parent-1', 'gw-1');

    expect(prisma.gateway.update).toHaveBeenCalledWith({
      where: { id: 'gw-1' },
      data: {
        token: expect.any(String),
        previousToken: 'old-tok',
        previousTokenExpiresAt: expect.any(Date),
      },
    });
    expect(result.token).not.toBe('old-tok');
    expect(result.previousTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('defaults the grace period to 24 hours', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, buildAudit());

    const before = Date.now();
    const result = await service.rotateToken('parent-1', 'gw-1');
    const expectedMs = 24 * 60 * 60 * 1000;

    expect(result.previousTokenExpiresAt!.getTime() - before).toBeGreaterThanOrEqual(expectedMs - 5000);
    expect(result.previousTokenExpiresAt!.getTime() - before).toBeLessThanOrEqual(expectedMs + 5000);
  });

  it('accepts a custom grace period', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, buildAudit());

    const before = Date.now();
    const result = await service.rotateToken('parent-1', 'gw-1', 60 * 60 * 1000);

    expect(result.previousTokenExpiresAt!.getTime() - before).toBeLessThanOrEqual(65 * 60 * 1000);
  });

  it('writes an audit log entry for the rotation', async () => {
    const prisma = buildPrisma();
    const audit = buildAudit();
    const service = new GatewayService(prisma, audit);

    await service.rotateToken('parent-1', 'gw-1');

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'parent-1',
        action: 'gateway.token_rotated',
        entity: 'gateway',
        entityId: 'gw-1',
      }),
    );
  });

  it('generates a different token on each rotation', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, buildAudit());

    const first = await service.rotateToken('parent-1', 'gw-1');
    const second = await service.rotateToken('parent-1', 'gw-1');

    expect(first.token).not.toBe(second.token);
  });
});
