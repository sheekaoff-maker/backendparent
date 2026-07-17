import { PushService } from '../src/push/push.service';

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

  it('sendToUser does nothing when the user has no registered devices (offline device)', async () => {
    const sendMulticast = jest.fn();
    const service = new PushService(prisma, { sendMulticast } as any);
    await service.sendToUser('u1', { title: 'x', body: 'y' });
    expect(sendMulticast).not.toHaveBeenCalled();
  });

  it('sendToUser fans out via a single multicast call and prunes invalid tokens', async () => {
    prisma.pushToken.findMany.mockResolvedValue([{ token: 'good' }, { token: 'stale' }]);
    const sendMulticast = jest
      .fn()
      .mockResolvedValue({ sent: ['good'], invalid: ['stale'], errored: [], skipped: false });
    const service = new PushService(prisma, { sendMulticast } as any);

    await service.sendToUser('u1', { title: 'x', body: 'y' });

    expect(sendMulticast).toHaveBeenCalledTimes(1);
    expect(sendMulticast).toHaveBeenCalledWith(['good', 'stale'], { title: 'x', body: 'y' });
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['stale'] } },
    });
  });

  it('sendToUser does not touch the token table when nothing is invalid', async () => {
    prisma.pushToken.findMany.mockResolvedValue([{ token: 'good' }]);
    const sendMulticast = jest
      .fn()
      .mockResolvedValue({ sent: ['good'], invalid: [], errored: [], skipped: false });
    const service = new PushService(prisma, { sendMulticast } as any);

    await service.sendToUser('u1', { title: 'x', body: 'y' });

    expect(prisma.pushToken.deleteMany).not.toHaveBeenCalled();
  });

  it('deliveryEnabled reflects the sender configuration', () => {
    expect(new PushService(prisma, { isConfigured: true } as any).deliveryEnabled).toBe(true);
    expect(new PushService(prisma, { isConfigured: false } as any).deliveryEnabled).toBe(false);
  });
});
