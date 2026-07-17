import { DnsPolicyService } from '../src/dns-policy/dns-policy.service';

/**
 * Integration tests for the DNS decision engine — the core of the product.
 * Uses a real in-memory cache (Map) and a mocked Prisma so every branch of
 * checkPolicy is exercised end to end: allow, full lock, manual block, session
 * expiry, exact/wildcard domain block, category block (active + inactive),
 * strict-mode DoH, caching, and version-based cache invalidation.
 */
function fakeCache() {
  const m = new Map<string, unknown>();
  return {
    get: async (k: string) => m.get(k),
    set: async (k: string, v: unknown) => {
      m.set(k, v);
    },
    del: async (k: string) => {
      m.delete(k);
    },
    _map: m,
  };
}

interface PrismaMockConfig {
  device?: any;
  session?: any;
  blockedDomains?: Array<{ domain: string; category?: string | null }>;
  categoryBlock?: { active: boolean } | null;
}

function mockPrisma(cfg: PrismaMockConfig) {
  return {
    device: {
      findFirst: jest.fn().mockResolvedValue(cfg.device ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    session: {
      findFirst: jest.fn().mockResolvedValue(cfg.session ?? null),
    },
    blockedDomain: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const candidates: string[] = where.domain.in;
        const hit = (cfg.blockedDomains ?? []).find((b) => candidates.includes(b.domain));
        return Promise.resolve(hit ?? null);
      }),
    },
    categoryBlock: {
      findUnique: jest.fn().mockResolvedValue(cfg.categoryBlock ?? null),
    },
    dnsQueryLog: { create: jest.fn().mockResolvedValue({}) },
    unknownDomainLog: { upsert: jest.fn().mockResolvedValue({}) },
  } as any;
}

const DEVICE = {
  id: 'dev1',
  childId: 'child1',
  ipAddress: '10.0.0.5',
  dnsSourceIp: null,
  status: 'ONLINE',
  internetLocked: false,
};

function svc(prisma: any, cache: any) {
  return new DnsPolicyService(prisma, cache);
}

describe('DnsPolicyService.checkPolicy — decision engine', () => {
  it('ALLOWS when the source IP maps to no device', async () => {
    const prisma = mockPrisma({ device: null });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '1.2.3.4', domain: 'x.com' });
    expect(r.action).toBe('ALLOW');
  });

  it('BLOCKS everything under full internet lock', async () => {
    const prisma = mockPrisma({ device: { ...DEVICE, internetLocked: true } });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'anything.com' });
    expect(r).toMatchObject({ action: 'BLOCK', reason: 'FULL_INTERNET_LOCK' });
  });

  it('BLOCKS a manually-blocked device', async () => {
    const prisma = mockPrisma({ device: { ...DEVICE, status: 'BLOCKED' } });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'x.com' });
    expect(r).toMatchObject({ action: 'BLOCK', reason: 'MANUAL_BLOCK' });
  });

  it('BLOCKS when the active session has expired (remaining <= 0)', async () => {
    const prisma = mockPrisma({
      device: DEVICE,
      session: {
        status: 'ACTIVE',
        startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3h ago
        resumedAt: null,
        durationMinutes: 60,
        remainingMinutes: 60,
      },
    });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'x.com' });
    expect(r).toMatchObject({ action: 'BLOCK', reason: 'TIME_LIMIT_EXCEEDED' });
  });

  it('ALLOWS while the active session still has time', async () => {
    const prisma = mockPrisma({
      device: DEVICE,
      session: {
        status: 'ACTIVE',
        startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        resumedAt: null,
        durationMinutes: 60,
        remainingMinutes: 60,
      },
    });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'ok.com' });
    expect(r.action).toBe('ALLOW');
  });

  it('BLOCKS an exact blocked domain (no category)', async () => {
    const prisma = mockPrisma({ device: DEVICE, blockedDomains: [{ domain: 'badsite.com', category: null }] });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'badsite.com' });
    expect(r).toMatchObject({ action: 'BLOCK', reason: 'DOMAIN_BLOCKED' });
  });

  it('BLOCKS a subdomain of a blocked domain (wildcard/suffix match)', async () => {
    const prisma = mockPrisma({ device: DEVICE, blockedDomains: [{ domain: 'youtube.com', category: null }] });
    const r = await svc(prisma, fakeCache()).checkPolicy({
      sourceIp: '10.0.0.5',
      domain: 'www.api.youtube.com',
    });
    expect(r.action).toBe('BLOCK');
  });

  it('BLOCKS a categorised domain when the child has that category active', async () => {
    const prisma = mockPrisma({
      device: DEVICE,
      blockedDomains: [{ domain: 'roblox.com', category: 'GAMING' }],
      categoryBlock: { active: true },
    });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'roblox.com' });
    expect(r).toMatchObject({ action: 'BLOCK', reason: 'CATEGORY_BLOCKED', category: 'GAMING' });
  });

  it('still BLOCKS (DOMAIN_BLOCKED) a listed domain even if its category is inactive — documents current behaviour', async () => {
    const prisma = mockPrisma({
      device: DEVICE,
      blockedDomains: [{ domain: 'roblox.com', category: 'GAMING' }],
      categoryBlock: { active: false },
    });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'roblox.com' });
    // NOTE: any domain present in the blocklist is blocked via the 4b fallthrough,
    // so toggling the category OFF does not re-allow a seeded domain.
    expect(r).toMatchObject({ action: 'BLOCK', reason: 'DOMAIN_BLOCKED' });
  });

  it('ALLOWS an unknown domain and records it for later classification', async () => {
    const prisma = mockPrisma({ device: DEVICE, blockedDomains: [] });
    const r = await svc(prisma, fakeCache()).checkPolicy({ sourceIp: '10.0.0.5', domain: 'newsite.com' });
    expect(r.action).toBe('ALLOW');
    expect(prisma.unknownDomainLog.upsert).toHaveBeenCalled();
  });

  it('caches the decision — a repeat lookup does not re-hit the database', async () => {
    const prisma = mockPrisma({ device: DEVICE, blockedDomains: [{ domain: 'bad.com' }] });
    const cache = fakeCache();
    const service = svc(prisma, cache);
    await service.checkPolicy({ sourceIp: '10.0.0.5', domain: 'bad.com' });
    await service.checkPolicy({ sourceIp: '10.0.0.5', domain: 'bad.com' });
    expect(prisma.device.findFirst).toHaveBeenCalledTimes(1);
  });

  it('invalidateSourceIps busts the cache — the next lookup recomputes', async () => {
    const prisma = mockPrisma({ device: DEVICE, blockedDomains: [{ domain: 'bad.com' }] });
    const cache = fakeCache();
    const service = svc(prisma, cache);
    await service.checkPolicy({ sourceIp: '10.0.0.5', domain: 'bad.com' });
    await service.invalidateSourceIps(['10.0.0.5']);
    await service.checkPolicy({ sourceIp: '10.0.0.5', domain: 'bad.com' });
    expect(prisma.device.findFirst).toHaveBeenCalledTimes(2);
  });
});

describe('DnsPolicyService.checkPolicy — STRICT MODE (anti-DoH)', () => {
  const saved = process.env.STRICT_MODE;
  afterAll(() => {
    if (saved === undefined) delete process.env.STRICT_MODE;
    else process.env.STRICT_MODE = saved;
  });

  it('BLOCKS a well-known DoH resolver domain when STRICT_MODE=true', async () => {
    process.env.STRICT_MODE = 'true';
    const prisma = mockPrisma({ device: DEVICE });
    const r = await new DnsPolicyService(prisma, fakeCache() as any).checkPolicy({
      sourceIp: '10.0.0.5',
      domain: 'dns.google',
    });
    expect(r).toMatchObject({ action: 'BLOCK', reason: 'STRICT_MODE_DOH' });
  });
});
