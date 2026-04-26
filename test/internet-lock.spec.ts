import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DnsPolicyService } from '../src/dns-policy/dns-policy.service';
import { PrismaService } from '../src/common/prisma.service';

const mkPrisma = () => ({
  device: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  session: { findFirst: jest.fn().mockResolvedValue(null) },
  blockedDomain: { findFirst: jest.fn() },
  categoryBlock: { findUnique: jest.fn() },
  dnsQueryLog: { create: jest.fn().mockResolvedValue({}) },
});

const mkCache = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(null),
});

describe('DnsPolicyService — Full Internet Lock', () => {
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

  it('BLOCKs ANY domain when device.internetLocked=true', async () => {
    prisma.device.findFirst.mockResolvedValue({
      id: 'd1',
      status: 'ONLINE',
      childId: 'c1',
      internetLocked: true,
      blockingMode: 'FULL_INTERNET_LOCK',
    });
    const r1 = await service.checkPolicy({ sourceIp: '10.0.0.5', domain: 'google.com' });
    const r2 = await service.checkPolicy({ sourceIp: '10.0.0.5', domain: 'wikipedia.org' });
    expect(r1.action).toBe('BLOCK');
    expect(r1.reason).toBe('FULL_INTERNET_LOCK');
    expect(r2.action).toBe('BLOCK');
    expect(r2.reason).toBe('FULL_INTERNET_LOCK');
    // blockedDomain lookup must NOT be called when fully locked
    expect(prisma.blockedDomain.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to gaming/category logic when internetLocked=false', async () => {
    prisma.device.findFirst.mockResolvedValue({
      id: 'd1',
      status: 'ONLINE',
      childId: 'c1',
      internetLocked: false,
      blockingMode: 'GAMING_ONLY',
    });
    prisma.blockedDomain.findFirst.mockResolvedValue(null);
    const res = await service.checkPolicy({ sourceIp: '10.0.0.6', domain: 'wikipedia.org' });
    expect(res.action).toBe('ALLOW');
  });

  it('CATEGORY_BLOCKED still works under GAMING_ONLY mode', async () => {
    prisma.device.findFirst.mockResolvedValue({
      id: 'd1',
      status: 'ONLINE',
      childId: 'c1',
      internetLocked: false,
      blockingMode: 'GAMING_ONLY',
    });
    prisma.blockedDomain.findFirst.mockResolvedValue({
      domain: 'roblox.com',
      category: 'GAMING',
      wildcard: true,
    });
    prisma.categoryBlock.findUnique.mockResolvedValue({ active: true, category: 'GAMING' });
    const res = await service.checkPolicy({ sourceIp: '10.0.0.7', domain: 'web.roblox.com' });
    expect(res.action).toBe('BLOCK');
    expect(res.reason).toBe('CATEGORY_BLOCKED');
  });

  it('parent-domain matching still works (www.api.youtube.com → youtube.com)', async () => {
    prisma.device.findFirst.mockResolvedValue({
      id: 'd1',
      status: 'ONLINE',
      childId: 'c1',
      internetLocked: false,
    });
    prisma.blockedDomain.findFirst.mockResolvedValue({
      domain: 'youtube.com',
      category: 'STREAMING',
      wildcard: true,
    });
    prisma.categoryBlock.findUnique.mockResolvedValue(null);
    const res = await service.checkPolicy({ sourceIp: '10.0.0.8', domain: 'www.api.youtube.com' });
    expect(res.action).toBe('BLOCK');
    expect(res.reason).toBe('DOMAIN_BLOCKED');
  });
});

describe('DevicesService — internet lock/unlock', () => {
  // Light-weight unit test for state transitions
  const { DevicesService } = require('../src/devices/devices.service');

  const makePrisma = (existing: any) => ({
    device: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...existing, ...data })),
    },
  });
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  it('lockInternet sets blockingMode=FULL_INTERNET_LOCK + internetLocked=true', async () => {
    const existing = { id: 'd1', parentId: 'p1', type: 'PLAYSTATION', ipAddress: '10.0.0.9', dnsSourceIp: null };
    const prisma = makePrisma(existing);
    const svc = new DevicesService(prisma, cache);
    const result = await svc.lockInternet('p1', 'd1', 'screen-time over');
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({
        blockingMode: 'FULL_INTERNET_LOCK',
        internetLocked: true,
        internetLockedReason: 'screen-time over',
      }),
    });
    expect(result.internetLocked).toBe(true);
  });

  it('unlockInternet restores GAMING_ONLY + internetLocked=false', async () => {
    const existing = {
      id: 'd1', parentId: 'p1', type: 'PLAYSTATION',
      ipAddress: '10.0.0.9', dnsSourceIp: null,
      internetLocked: true, blockingMode: 'FULL_INTERNET_LOCK',
    };
    const prisma = makePrisma(existing);
    const svc = new DevicesService(prisma, cache);
    const result = await svc.unlockInternet('p1', 'd1');
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({
        blockingMode: 'GAMING_ONLY',
        internetLocked: false,
        internetLockedReason: null,
        internetLockedAt: null,
      }),
    });
    expect(result.internetLocked).toBe(false);
  });

  it('forbids access when parentId does not match', async () => {
    const existing = { id: 'd1', parentId: 'someone-else', type: 'XBOX', ipAddress: null, dnsSourceIp: null };
    const prisma = makePrisma(existing);
    const svc = new DevicesService(prisma, cache);
    await expect(svc.lockInternet('p1', 'd1')).rejects.toThrow();
  });
});
