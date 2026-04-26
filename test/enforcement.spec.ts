import { getAdapterForDevice, isOfflineGameUnsupported } from '../src/enforcement/adapters/control-adapter.interface';
import { MockAdapter } from '../src/enforcement/adapters/mock.adapter';
import { AndroidAgentAdapter } from '../src/enforcement/adapters/android-agent.adapter';
import { IosScreenTimeAdapter } from '../src/enforcement/adapters/ios-screen-time.adapter';
import { XboxAdapter } from '../src/enforcement/adapters/xbox.adapter';
import { NetworkGatewayAdapter } from '../src/enforcement/adapters/network-gateway.adapter';
import { EnforcementService } from '../src/enforcement/enforcement.service';
import { PrismaService } from '../src/common/prisma.service';
import { Device, ControlMethod, DeviceType } from '@prisma/client';

describe('Adapter Selection', () => {
  it('should select ANDROID_AGENT for Android phone', () => {
    const result = getAdapterForDevice({ type: DeviceType.ANDROID_PHONE } as Device);
    expect(result).toBe(ControlMethod.ANDROID_AGENT);
  });

  it('should select ANDROID_AGENT for Android tablet', () => {
    const result = getAdapterForDevice({ type: DeviceType.ANDROID_TABLET } as Device);
    expect(result).toBe(ControlMethod.ANDROID_AGENT);
  });

  it('should select IOS_SCREEN_TIME for iPhone', () => {
    const result = getAdapterForDevice({ type: DeviceType.IPHONE } as Device);
    expect(result).toBe(ControlMethod.IOS_SCREEN_TIME);
  });

  it('should select IOS_SCREEN_TIME for iPad', () => {
    const result = getAdapterForDevice({ type: DeviceType.IPAD } as Device);
    expect(result).toBe(ControlMethod.IOS_SCREEN_TIME);
  });

  it('should select XBOX_ADAPTER for Xbox', () => {
    const result = getAdapterForDevice({ type: DeviceType.XBOX } as Device);
    expect(result).toBe(ControlMethod.XBOX_ADAPTER);
  });

  it('should select NETWORK_GATEWAY for PlayStation', () => {
    const result = getAdapterForDevice({ type: DeviceType.PLAYSTATION } as Device);
    expect(result).toBe(ControlMethod.NETWORK_GATEWAY);
  });

  it('should select NETWORK_GATEWAY for Smart TV', () => {
    const result = getAdapterForDevice({ type: DeviceType.SMART_TV } as Device);
    expect(result).toBe(ControlMethod.NETWORK_GATEWAY);
  });

  it('should select NETWORK_GATEWAY for streaming box', () => {
    const result = getAdapterForDevice({ type: DeviceType.STREAMING_BOX } as Device);
    expect(result).toBe(ControlMethod.NETWORK_GATEWAY);
  });
});

describe('EnforcementService - getAdapter', () => {
  let service: EnforcementService;
  let prismaMock: Partial<PrismaService>;

  beforeEach(() => {
    prismaMock = {};
    const android = new AndroidAgentAdapter(prismaMock as PrismaService);
    const ios = new IosScreenTimeAdapter(prismaMock as PrismaService);
    const xbox = new XboxAdapter(prismaMock as PrismaService, { encrypt: jest.fn(), decrypt: jest.fn() } as any);
    const network = new NetworkGatewayAdapter(prismaMock as PrismaService);
    const mock = new MockAdapter();
    service = new EnforcementService(prismaMock as PrismaService, android, ios, xbox, network, mock);
  });

  it('should return MockAdapter for MOCK control method', () => {
    const adapter = service.getAdapter({ controlMethod: ControlMethod.MOCK } as Device);
    expect(adapter).toBeInstanceOf(MockAdapter);
  });

  it('should return AndroidAgentAdapter for ANDROID_AGENT control method', () => {
    const adapter = service.getAdapter({ controlMethod: ControlMethod.ANDROID_AGENT } as Device);
    expect(adapter).toBeInstanceOf(AndroidAgentAdapter);
  });

  it('should return IosScreenTimeAdapter for IOS_SCREEN_TIME control method', () => {
    const adapter = service.getAdapter({ controlMethod: ControlMethod.IOS_SCREEN_TIME } as Device);
    expect(adapter).toBeInstanceOf(IosScreenTimeAdapter);
  });

  it('should return XboxAdapter for XBOX_ADAPTER control method', () => {
    const adapter = service.getAdapter({ controlMethod: ControlMethod.XBOX_ADAPTER } as Device);
    expect(adapter).toBeInstanceOf(XboxAdapter);
  });

  it('should return NetworkGatewayAdapter for NETWORK_GATEWAY control method', () => {
    const adapter = service.getAdapter({ controlMethod: ControlMethod.NETWORK_GATEWAY } as Device);
    expect(adapter).toBeInstanceOf(NetworkGatewayAdapter);
  });

  it('should fallback to MockAdapter for unknown control method', () => {
    const adapter = service.getAdapter({ controlMethod: 'UNKNOWN' as ControlMethod } as Device);
    expect(adapter).toBeInstanceOf(MockAdapter);
  });
});

describe('Android Command Creation', () => {
  it('should create block apps command via AndroidAgentAdapter', async () => {
    const createMock = jest.fn().mockResolvedValue({ id: 'cmd1' });
    const prismaMock = { command: { create: createMock } } as unknown as PrismaService;
    const adapter = new AndroidAgentAdapter(prismaMock);

    const device = { id: 'dev1', status: 'ONLINE', lastSeen: new Date() } as Device;
    const result = await adapter.blockDevice(device, 'test reason');

    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: 'dev1',
        type: 'LOCK_DEVICE',
      }),
    });
  });

  it('should create sync rules command via AndroidAgentAdapter', async () => {
    const createMock = jest.fn().mockResolvedValue({ id: 'cmd2' });
    const prismaMock = { command: { create: createMock } } as unknown as PrismaService;
    const adapter = new AndroidAgentAdapter(prismaMock);

    const device = { id: 'dev1', status: 'ONLINE', lastSeen: new Date() } as Device;
    const rules = { dailyLimit: 60 };
    const result = await adapter.startSession(device, rules);

    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalled();
  });
});

describe('iOS Rule Sync', () => {
  it('should sync rules to iOS agent', async () => {
    const createMock = jest.fn().mockResolvedValue({ id: 'cmd1' });
    const prismaMock = { command: { create: createMock } } as unknown as PrismaService;
    const adapter = new IosScreenTimeAdapter(prismaMock);

    const device = { id: 'dev1', status: 'ONLINE', lastSeen: new Date() } as Device;
    const result = await adapter.startSession(device, { dailyLimit: 60 });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Apple Family Controls');
  });
});

describe('Gateway Block Fallback', () => {
  it('should return success when gateway is assigned', async () => {
    const prismaMock = {
      gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw1', paired: true }) },
    } as unknown as PrismaService;
    const adapter = new NetworkGatewayAdapter(prismaMock);

    const device = { id: 'dev1', gatewayId: 'gw1', status: 'ONLINE', lastSeen: new Date() } as Device;
    const result = await adapter.blockDevice(device, 'test');

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('offlineLimitation', true);
  });

  it('should fail when no gateway is assigned', async () => {
    const prismaMock = {} as unknown as PrismaService;
    const adapter = new NetworkGatewayAdapter(prismaMock);

    const device = { id: 'dev1', gatewayId: null, status: 'ONLINE' } as unknown as Device;
    const result = await adapter.blockDevice(device, 'test');

    expect(result.success).toBe(false);
  });
});

describe('Offline Unsupported Console Behavior', () => {
  it('should identify PlayStation as offline-game unsupported', () => {
    const device = { type: DeviceType.PLAYSTATION } as Device;
    expect(isOfflineGameUnsupported(device)).toBe(true);
  });

  it('should identify Smart TV as offline-game unsupported', () => {
    const device = { type: DeviceType.SMART_TV } as Device;
    expect(isOfflineGameUnsupported(device)).toBe(true);
  });

  it('should identify streaming box as offline-game unsupported', () => {
    const device = { type: DeviceType.STREAMING_BOX } as Device;
    expect(isOfflineGameUnsupported(device)).toBe(true);
  });

  it('should NOT identify Android phone as offline-game unsupported', () => {
    const device = { type: DeviceType.ANDROID_PHONE } as Device;
    expect(isOfflineGameUnsupported(device)).toBe(false);
  });

  it('should NOT identify iPhone as offline-game unsupported', () => {
    const device = { type: DeviceType.IPHONE } as Device;
    expect(isOfflineGameUnsupported(device)).toBe(false);
  });

  it('should handle offline violation with gateway', async () => {
    const prismaMock = {
      device: { update: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const mockAdapter = new MockAdapter();
    const androidAdapter = new AndroidAgentAdapter(prismaMock);
    const iosAdapter = new IosScreenTimeAdapter(prismaMock);
    const xboxAdapter = new XboxAdapter(prismaMock, { encrypt: jest.fn(), decrypt: jest.fn() } as any);
    const networkAdapter = new NetworkGatewayAdapter(prismaMock);
    const service = new EnforcementService(prismaMock, androidAdapter, iosAdapter, xboxAdapter, networkAdapter, mockAdapter);

    const device = {
      id: 'dev1',
      type: DeviceType.PLAYSTATION,
      controlMethod: ControlMethod.NETWORK_GATEWAY,
      gatewayId: 'gw1',
      status: 'ONLINE',
    } as Device;

    const result = await service.handleOfflineViolation(device, 'session1');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('offlineLimitation', true);
    expect(result.data?.actions).toContain('block_internet_via_gateway');
    expect(result.data?.actions).toContain('notify_parent');
    expect(result.data?.actions).toContain('mark_session_violated');
  });
});

describe('Scheduler Expiration', () => {
  it('should expire session when remaining time is 0', () => {
    const session = {
      startedAt: new Date(Date.now() - 120 * 60000),
      resumedAt: null,
      pausedAt: null,
      durationMinutes: 60,
      extendedMinutes: 0,
      status: SessionStatus.ACTIVE,
    };

    const prismaMock = {} as PrismaService;
    const rulesServiceMock = {
      getDailyLimit: jest.fn().mockResolvedValue(null),
      getActiveRulesForChild: jest.fn().mockResolvedValue([]),
    } as unknown as RulesService;
    const service = new SessionsService(prismaMock, rulesServiceMock);

    const remaining = service.calculateRemainingMinutes(session);
    expect(remaining).toBe(0);
  });
});
