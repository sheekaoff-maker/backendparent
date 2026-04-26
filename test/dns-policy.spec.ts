import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DnsPolicyService } from '../src/dns-policy/dns-policy.service';
import { PrismaService } from '../src/common/prisma.service';
import { getPlatformSupport } from '../src/platform-support/platform-support.matrix';

const mkPrisma = (overrides: any = {}) => ({
  device: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  session: { findFirst: jest.fn().mockResolvedValue(null) },
  blockedDomain: { findFirst: jest.fn() },
  categoryBlock: { findUnique: jest.fn() },
  dnsQueryLog: { create: jest.fn().mockResolvedValue({}) },
  ...overrides,
});

const mkCache = () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(null) });

describe('DnsPolicyService — gaming/category logic', () => {
  let service: DnsPolicyService;
  let prisma: any;
  let cache: any;

  beforeEach(async () => {
    prisma = mkPrisma();
    cache = mkCache();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DnsPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(DnsPolicyService);
  });

  it('ALLOWs when no device matches sourceIp', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    const res = await service.checkPolicy({ sourceIp: '10.0.0.1', domain: 'example.com' });
    expect(res.action).toBe('ALLOW');
  });

  it('BLOCKs with MANUAL_BLOCK when device.status=BLOCKED', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 'd1', status: 'BLOCKED', childId: 'c1' });
    const res = await service.checkPolicy({ sourceIp: '10.0.0.2', domain: 'example.com' });
    expect(res.action).toBe('BLOCK');
    expect(res.reason).toBe('MANUAL_BLOCK');
  });

  it('matches parent domain (www.youtube.com → youtube.com entry)', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 'd1', status: 'ONLINE', childId: 'c1' });
    prisma.blockedDomain.findFirst.mockResolvedValue({
      domain: 'youtube.com',
      category: 'STREAMING',
      wildcard: true,
    });
    prisma.categoryBlock.findUnique.mockResolvedValue(null); // no category block
    const res = await service.checkPolicy({ sourceIp: '10.0.0.3', domain: 'www.api.youtube.com' });
    expect(res.action).toBe('BLOCK');
    expect(res.reason).toBe('DOMAIN_BLOCKED');
  });

  it('returns CATEGORY_BLOCKED when child has GAMING category active', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 'd1', status: 'ONLINE', childId: 'c1' });
    prisma.blockedDomain.findFirst.mockResolvedValue({
      domain: 'roblox.com',
      category: 'GAMING',
      wildcard: true,
    });
    prisma.categoryBlock.findUnique.mockResolvedValue({ active: true, category: 'GAMING' });
    const res = await service.checkPolicy({ sourceIp: '10.0.0.4', domain: 'web.roblox.com' });
    expect(res.action).toBe('BLOCK');
    expect(res.reason).toBe('CATEGORY_BLOCKED');
    expect(res.category).toBe('GAMING');
  });
});

describe('Platform support matrix — offline games honesty', () => {
  it('PlayStation: offline NOT supported, online supported', () => {
    const ps = getPlatformSupport('PLAYSTATION' as any);
    expect(ps.onlineControl).toBe(true);
    expect(ps.offlineControlSupported).toBe(false);
    expect(ps.offlineControlMethod).toBe('NOT_SUPPORTED');
  });

  it('Nintendo: offline NOT supported, online supported', () => {
    const n = getPlatformSupport('NINTENDO' as any);
    expect(n.offlineControlSupported).toBe(false);
  });

  it('Android: full offline + online support via agent', () => {
    const a = getPlatformSupport('ANDROID_PHONE' as any);
    expect(a.offlineControlSupported).toBe(true);
    expect(a.offlineControlMethod).toBe('ANDROID_AGENT');
  });

  it('Xbox: offline supported via Microsoft account', () => {
    const x = getPlatformSupport('XBOX' as any);
    expect(x.offlineControlSupported).toBe(true);
    expect(x.offlineControlMethod).toBe('XBOX_ACCOUNT');
  });
});
