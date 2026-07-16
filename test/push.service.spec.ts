import { PushService } from '../src/push/push.service';
import { FcmSender } from '../src/push/fcm.sender';

function buildPrisma() {
  return {
    pushToken: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('PushService', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
  });

  it('registerToken upserts keyed by token and re-points to the user', async () => {
    const service = new PushService(prisma, { isConfigured: false } as any);
    await service.registerToken('u1', 'tok-123', 'ios');
    const arg = prisma.pushToken.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ token: 'tok-123' });
    expect(arg.update.userId).toBe('u1');
    expect(arg.create).toEqual({ userId: 'u1', token: 'tok-123', platform: 'ios' });
  });

  it('removeToken scopes deletion to the owning user', async () => {
    const service = new PushService(prisma, { isConfigured: false } as any);
    await service.removeToken('u1', 'tok-123');
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: 'tok-123' },
    });
  });

  it('sendToUser does nothing when the user has no tokens', async () => {
    const send = jest.fn();
    const service = new PushService(prisma, { send } as any);
    await service.sendToUser('u1', { title: 'x', body: 'y' });
    expect(send).not.toHaveBeenCalled();
  });

  it('sendToUser prunes tokens FCM reports as invalid', async () => {
    prisma.pushToken.findMany.mockResolvedValue([{ token: 'good' }, { token: 'stale' }]);
    const fcm = {
      send: jest.fn(async (token: string) => (token === 'stale' ? 'invalid' : 'sent')),
    } as any;
    const service = new PushService(prisma, fcm);

    await service.sendToUser('u1', { title: 'x', body: 'y' });

    expect(fcm.send).toHaveBeenCalledTimes(2);
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['stale'] } },
    });
  });

  it('deliveryEnabled reflects the sender configuration', () => {
    expect(new PushService(prisma, { isConfigured: true } as any).deliveryEnabled).toBe(true);
    expect(new PushService(prisma, { isConfigured: false } as any).deliveryEnabled).toBe(false);
  });
});

describe('FcmSender', () => {
  const KEYS = ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'];
  const saved: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const k of KEYS) saved[k] = process.env[k];
  });
  afterAll(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is not configured and skips sending when the service account is absent', async () => {
    for (const k of KEYS) delete process.env[k];
    const sender = new FcmSender();
    expect(sender.isConfigured).toBe(false);
    await expect(sender.send('tok', { title: 't', body: 'b' })).resolves.toBe('skipped');
  });
});
