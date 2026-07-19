import { GatewayService } from '../src/gateway/gateway.service';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.gateway,
    },
  } as any;
}

describe('GatewayService.listGateways', () => {
  it('scopes the query to the requesting parent and orders oldest first', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma);

    await service.listGateways('parent-1');

    expect(prisma.gateway.findMany).toHaveBeenCalledWith({
      where: { parentId: 'parent-1' },
      select: { id: true, name: true, endpoint: true, paired: true, pairedAt: true, lastSeen: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns whatever the query resolves (including an empty list for a parent with no gateways)', async () => {
    const prisma = buildPrisma({ gateway: { findMany: jest.fn().mockResolvedValue([{ id: 'gw-1', name: 'Home Router' }]) } });
    const service = new GatewayService(prisma);

    const result = await service.listGateways('parent-1');
    expect(result).toEqual([{ id: 'gw-1', name: 'Home Router' }]);
  });
});
