import { PairingService } from '../src/pairing/pairing.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Unit tests for PairingService — the auto-pairing/IP-auto-repair core.
 * Mirrors the mocked-dependency style used by dns-policy.engine.spec.ts:
 * plain jest.fn() stand-ins for PairingRepository/AuditService, service
 * instantiated directly (no NestJS TestingModule needed for pure logic).
 */

const PARENT_ID = 'parent-1';
const DEVICE_ID = 'device-1';
const OTHER_PARENT = 'parent-2';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findDeviceForOwner: jest.fn(),
    findDeviceByBeaconToken: jest.fn(),
    deleteWaitingSessionsForDevice: jest.fn().mockResolvedValue({ count: 0 }),
    createSession: jest.fn(),
    findLatestWaitingSession: jest.fn(),
    findSessionByToken: jest.fn(),
    markSessionStatus: jest.fn().mockResolvedValue({}),
    incrementSessionAttempts: jest.fn().mockResolvedValue({ attempts: 1 }),
    deleteSession: jest.fn().mockResolvedValue({}),
    markDevicePaired: jest.fn().mockResolvedValue({}),
    setDevicePairStatus: jest.fn().mockResolvedValue({}),
    touchLastSeen: jest.fn().mockResolvedValue({}),
    applyIpChange: jest.fn().mockResolvedValue({}),
    upsertIpHistory: jest.fn().mockResolvedValue({}),
    recordConnectionEvent: jest.fn().mockResolvedValue({}),
    listRecentConnectionEvents: jest.fn().mockResolvedValue([]),
    listIpHistory: jest.fn().mockResolvedValue([]),
    runInTransaction: jest.fn().mockImplementation(async (fn: any) => fn({})),
    listByParentAndStatus: jest.fn(),
    listExpiredSessions: jest.fn(),
    countQueriesSince: jest.fn().mockResolvedValue(0),
    lastQueryFor: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as any;
}

function mockAudit() {
  return { log: jest.fn().mockResolvedValue({}) } as any;
}

const DEVICE = {
  id: DEVICE_ID,
  parentId: PARENT_ID,
  paired: false,
  pairStatus: 'WAITING',
  pairedAt: null,
  dnsSourceIp: null,
  publicIp: null,
  resolverRegion: null,
  lastDnsSeenAt: null,
  dnsBeaconToken: null,
};

describe('PairingService.startPairing', () => {
  it('creates a fresh session and invalidates any prior one', async () => {
    const repo = mockRepo({
      findDeviceForOwner: jest.fn().mockResolvedValue(DEVICE),
      createSession: jest.fn().mockResolvedValue({ id: 'sess-1' }),
    });
    const svc = new PairingService(repo, mockAudit());

    const result = await svc.startPairing(DEVICE_ID, PARENT_ID);

    expect(repo.deleteWaitingSessionsForDevice).toHaveBeenCalledWith(DEVICE_ID);
    expect(repo.createSession).toHaveBeenCalled();
    expect(repo.setDevicePairStatus).toHaveBeenCalledWith(DEVICE_ID, 'WAITING');
    expect(result.sessionId).toBe('sess-1');
    expect(result.qrPayload).toContain(DEVICE_ID);
  });

  it('throws NotFoundException for a nonexistent device', async () => {
    const repo = mockRepo({ findDeviceForOwner: jest.fn().mockResolvedValue(null) });
    const svc = new PairingService(repo, mockAudit());
    await expect(svc.startPairing(DEVICE_ID, PARENT_ID)).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when the device belongs to another parent', async () => {
    const repo = mockRepo({ findDeviceForOwner: jest.fn().mockResolvedValue(DEVICE) });
    const svc = new PairingService(repo, mockAudit());
    await expect(svc.startPairing(DEVICE_ID, OTHER_PARENT)).rejects.toThrow(ForbiddenException);
  });
});

describe('PairingService.getStatus', () => {
  it('derives connectionQuality and hides beaconToken while unpaired', async () => {
    const repo = mockRepo({ findDeviceForOwner: jest.fn().mockResolvedValue(DEVICE) });
    const svc = new PairingService(repo, mockAudit());

    const status = await svc.getStatus(DEVICE_ID, PARENT_ID);

    expect(status.connectionQuality).toBe('OFFLINE');
    expect(status.beaconToken).toBeNull();
  });

  it('reports EXCELLENT quality and the beacon token once paired and recently seen', async () => {
    const repo = mockRepo({
      findDeviceForOwner: jest.fn().mockResolvedValue({
        ...DEVICE,
        paired: true,
        pairStatus: 'PAIRED',
        lastDnsSeenAt: new Date(),
        dnsBeaconToken: 'beacon-abc',
      }),
    });
    const svc = new PairingService(repo, mockAudit());

    const status = await svc.getStatus(DEVICE_ID, PARENT_ID);

    expect(status.connectionQuality).toBe('EXCELLENT');
    expect(status.beaconToken).toBe('beacon-abc');
  });
});

describe('PairingService.confirmProbe — initial pairing', () => {
  function waitingSession(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 'sess-1',
      deviceId: DEVICE_ID,
      parentId: PARENT_ID,
      token: 'tok-1',
      status: 'WAITING',
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      ...overrides,
    };
  }

  it('pairs the device on a valid, unexpired token', async () => {
    const repo = mockRepo({
      findSessionByToken: jest.fn().mockResolvedValue(waitingSession()),
      incrementSessionAttempts: jest.fn().mockResolvedValue({ attempts: 1 }),
    });
    const svc = new PairingService(repo, mockAudit());

    const result = await svc.confirmProbe({ token: 'tok-1', sourceIp: '203.0.113.5' });

    expect(result.deviceId).toBe(DEVICE_ID);
    expect(repo.markDevicePaired).toHaveBeenCalledWith(
      DEVICE_ID,
      expect.objectContaining({ sourceIp: '203.0.113.5' }),
      expect.anything(),
    );
    expect(repo.recordConnectionEvent).toHaveBeenCalledWith(
      DEVICE_ID,
      'PAIRED',
      '203.0.113.5',
      expect.anything(),
      expect.anything(),
    );
    expect(repo.deleteSession).toHaveBeenCalledWith('sess-1', expect.anything());
  });

  it('rejects and expires a token past its TTL', async () => {
    const repo = mockRepo({
      findSessionByToken: jest.fn().mockResolvedValue(waitingSession({ expiresAt: new Date(Date.now() - 1000) })),
    });
    const svc = new PairingService(repo, mockAudit());

    await expect(svc.confirmProbe({ token: 'tok-1', sourceIp: '203.0.113.5' })).rejects.toThrow(BadRequestException);
    expect(repo.markSessionStatus).toHaveBeenCalledWith('sess-1', 'EXPIRED', expect.anything());
    expect(repo.setDevicePairStatus).toHaveBeenCalledWith(DEVICE_ID, 'EXPIRED');
  });

  it('rejects a session that already left WAITING status', async () => {
    const repo = mockRepo({
      findSessionByToken: jest.fn().mockResolvedValue(waitingSession({ status: 'PAIRED' })),
    });
    const svc = new PairingService(repo, mockAudit());

    await expect(svc.confirmProbe({ token: 'tok-1', sourceIp: '203.0.113.5' })).rejects.toThrow(BadRequestException);
    expect(repo.markDevicePaired).not.toHaveBeenCalled();
  });

  it('fails a session after too many confirm attempts', async () => {
    const repo = mockRepo({
      findSessionByToken: jest.fn().mockResolvedValue(waitingSession()),
      incrementSessionAttempts: jest.fn().mockResolvedValue({ attempts: 6 }),
    });
    const svc = new PairingService(repo, mockAudit());

    await expect(svc.confirmProbe({ token: 'tok-1', sourceIp: '203.0.113.5' })).rejects.toThrow(BadRequestException);
    expect(repo.markSessionStatus).toHaveBeenCalledWith('sess-1', 'FAILED', expect.anything());
    expect(repo.setDevicePairStatus).toHaveBeenCalledWith(DEVICE_ID, 'FAILED');
  });
});

describe('PairingService.confirmProbe — beacon reaffirmation fallback', () => {
  it('falls back to beacon-token lookup when the token is not a pairing session', async () => {
    const pairedDevice = { ...DEVICE, paired: true, dnsSourceIp: '198.51.100.1' };
    const repo = mockRepo({
      findSessionByToken: jest.fn().mockResolvedValue(null),
      findDeviceByBeaconToken: jest.fn().mockResolvedValue(pairedDevice),
      findDeviceForOwner: jest.fn().mockResolvedValue(pairedDevice),
    });
    const svc = new PairingService(repo, mockAudit());

    const result = await svc.confirmProbe({ token: 'beacon-xyz', sourceIp: '198.51.100.9' });

    expect(result.deviceId).toBe(DEVICE_ID);
    expect(repo.findDeviceByBeaconToken).toHaveBeenCalledWith('beacon-xyz');
    // IP differs from the stored dnsSourceIp -> auto-repair path
    expect(repo.applyIpChange).toHaveBeenCalledWith(DEVICE_ID, '198.51.100.9', expect.any(Date), expect.anything());
  });

  it('throws NotFoundException when neither a session nor a beacon token matches', async () => {
    const repo = mockRepo({
      findSessionByToken: jest.fn().mockResolvedValue(null),
      findDeviceByBeaconToken: jest.fn().mockResolvedValue(null),
    });
    const svc = new PairingService(repo, mockAudit());

    await expect(svc.confirmProbe({ token: 'unknown', sourceIp: '203.0.113.5' })).rejects.toThrow(NotFoundException);
  });
});

describe('PairingService.recordHeartbeat', () => {
  it('is a no-op for an unpaired or missing device', async () => {
    const repo = mockRepo({ findDeviceForOwner: jest.fn().mockResolvedValue({ ...DEVICE, paired: false }) });
    const svc = new PairingService(repo, mockAudit());

    await svc.recordHeartbeat(DEVICE_ID, '203.0.113.5');

    expect(repo.touchLastSeen).not.toHaveBeenCalled();
    expect(repo.applyIpChange).not.toHaveBeenCalled();
  });

  it('just touches lastSeen when the IP is unchanged', async () => {
    const repo = mockRepo({
      findDeviceForOwner: jest.fn().mockResolvedValue({ ...DEVICE, paired: true, dnsSourceIp: '203.0.113.5' }),
    });
    const svc = new PairingService(repo, mockAudit());

    await svc.recordHeartbeat(DEVICE_ID, '203.0.113.5');

    expect(repo.touchLastSeen).toHaveBeenCalledWith(DEVICE_ID, expect.any(Date));
    expect(repo.applyIpChange).not.toHaveBeenCalled();
  });

  it('auto-repairs dnsSourceIp and records an IP_CHANGED event when the IP differs', async () => {
    const repo = mockRepo({
      findDeviceForOwner: jest.fn().mockResolvedValue({ ...DEVICE, paired: true, dnsSourceIp: '203.0.113.5' }),
    });
    const svc = new PairingService(repo, mockAudit());

    await svc.recordHeartbeat(DEVICE_ID, '203.0.113.99');

    expect(repo.applyIpChange).toHaveBeenCalledWith(DEVICE_ID, '203.0.113.99', expect.any(Date), expect.anything());
    expect(repo.recordConnectionEvent).toHaveBeenCalledWith(
      DEVICE_ID,
      'IP_CHANGED',
      '203.0.113.99',
      expect.objectContaining({ previous: '203.0.113.5' }),
      expect.anything(),
    );
  });
});

describe('PairingService.cancelPairing', () => {
  it('clears waiting sessions and audit-logs the cancellation', async () => {
    const repo = mockRepo({ findDeviceForOwner: jest.fn().mockResolvedValue(DEVICE) });
    const audit = mockAudit();
    const svc = new PairingService(repo, audit);

    await svc.cancelPairing(DEVICE_ID, PARENT_ID);

    expect(repo.deleteWaitingSessionsForDevice).toHaveBeenCalledWith(DEVICE_ID);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pairing.cancel' }));
  });

  it('throws ForbiddenException for a non-owner', async () => {
    const repo = mockRepo({ findDeviceForOwner: jest.fn().mockResolvedValue(DEVICE) });
    const svc = new PairingService(repo, mockAudit());
    await expect(svc.cancelPairing(DEVICE_ID, OTHER_PARENT)).rejects.toThrow(ForbiddenException);
  });
});

describe('PairingService.getConnectionStats', () => {
  it('returns zeroed stats for a device with no dnsSourceIp yet', async () => {
    const repo = mockRepo({ findDeviceForOwner: jest.fn().mockResolvedValue(DEVICE) });
    const svc = new PairingService(repo, mockAudit());

    const stats = await svc.getConnectionStats(DEVICE_ID, PARENT_ID);

    expect(stats.queriesToday).toBe(0);
    expect(stats.lastQueryDomain).toBeNull();
    expect(repo.countQueriesSince).not.toHaveBeenCalled();
  });

  it('counts today\'s queries once the device has a dnsSourceIp', async () => {
    const repo = mockRepo({
      findDeviceForOwner: jest.fn().mockResolvedValue({ ...DEVICE, dnsSourceIp: '203.0.113.5' }),
      countQueriesSince: jest.fn().mockResolvedValue(42),
      lastQueryFor: jest.fn().mockResolvedValue({ domain: 'example.com' }),
    });
    const svc = new PairingService(repo, mockAudit());

    const stats = await svc.getConnectionStats(DEVICE_ID, PARENT_ID);

    expect(stats.queriesToday).toBe(42);
    expect(stats.lastQueryDomain).toBe('example.com');
  });
});
