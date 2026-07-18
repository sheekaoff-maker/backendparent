import { DeviceFingerprintService } from '../src/gateway/device-fingerprint.service';
import { computeFingerprintHash } from '../src/gateway/device-fingerprint.util';

function buildPrisma(pendingDevices: any[] = []) {
  return {
    device: {
      findMany: jest.fn().mockResolvedValue(pendingDevices),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('DeviceFingerprintService', () => {
  it('skips entirely when no devices are pending a backfill', async () => {
    const prisma = buildPrisma([]);
    const service = new DeviceFingerprintService(prisma);

    await service.onModuleInit();

    expect(prisma.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fingerprintHash: null, macAddress: { not: null } } }),
    );
    expect(prisma.device.update).not.toHaveBeenCalled();
  });

  it('backfills fingerprintHash computed from each device\'s existing fields', async () => {
    const pending = [
      { id: 'dev-1', macAddress: 'aa:bb:cc:dd:ee:ff', hostname: null, dhcpClientId: null, vendorOui: null },
      { id: 'dev-2', macAddress: '11:22:33:44:55:66', hostname: 'laptop', dhcpClientId: null, vendorOui: 'Dell' },
    ];
    const prisma = buildPrisma(pending);
    const service = new DeviceFingerprintService(prisma);

    await service.onModuleInit();

    expect(prisma.device.update).toHaveBeenCalledTimes(2);

    const firstCall = prisma.device.update.mock.calls.find((c: any) => c[0].where.id === 'dev-1')[0];
    expect(firstCall.data.fingerprintHash).toBe(
      computeFingerprintHash({ macAddress: 'aa:bb:cc:dd:ee:ff', hostname: null, dhcpClientId: null, vendorOui: null }),
    );
    expect(firstCall.data.fingerprintUpdatedAt).toBeInstanceOf(Date);

    const secondCall = prisma.device.update.mock.calls.find((c: any) => c[0].where.id === 'dev-2')[0];
    expect(secondCall.data.fingerprintHash).toBe(
      computeFingerprintHash({ macAddress: '11:22:33:44:55:66', hostname: 'laptop', dhcpClientId: null, vendorOui: 'Dell' }),
    );
  });

  it('never throws even if the update loop fails partway through (best-effort backfill)', async () => {
    const prisma = buildPrisma([{ id: 'dev-1', macAddress: 'aa:bb:cc:dd:ee:ff' }]);
    prisma.device.update.mockRejectedValue(new Error('db unavailable'));
    const service = new DeviceFingerprintService(prisma);

    await expect(service.onModuleInit()).resolves.not.toThrow();
  });
});
