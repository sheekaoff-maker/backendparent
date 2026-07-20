import { GatewayService } from '../src/gateway/gateway.service';
import { NotFoundException } from '@nestjs/common';

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) } as any;
}

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1' }),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.gateway,
    },
    device: {
      findMany: jest.fn().mockResolvedValue([{ id: 'dev-1' }, { id: 'dev-2' }]),
      ...overrides.device,
    },
    vpnDetectionLog: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      ...overrides.vpnDetectionLog,
    },
  } as any;
}

describe('GatewayService.recordVpnDetections', () => {
  it('returns immediately without touching prisma when there is nothing to record', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, buildAudit());

    const result = await service.recordVpnDetections('gw-1', []);

    expect(result).toEqual({ recorded: 0 });
    expect(prisma.gateway.findUnique).not.toHaveBeenCalled();
  });

  it('throws when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new GatewayService(prisma, buildAudit());

    await expect(
      service.recordVpnDetections('missing-gw', [{ deviceId: 'dev-1', provider: 'NordVPN', method: 'dns-pattern' }]),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists detections only for devices that actually belong to this gateway', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma, buildAudit());

    const result = await service.recordVpnDetections('gw-1', [
      { deviceId: 'dev-1', provider: 'NordVPN', method: 'dns-pattern', detail: 'nordvpn.com' },
      { deviceId: 'dev-2', provider: 'WireGuard', method: 'port-signature', detail: '51820' },
      { deviceId: 'not-on-this-gateway', provider: 'Mullvad', method: 'ip-range' },
    ]);

    expect(result).toEqual({ recorded: 2 });
    const createArg = prisma.vpnDetectionLog.createMany.mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data.map((d: any) => d.deviceId)).toEqual(['dev-1', 'dev-2']);
    expect(createArg.data[0]).toMatchObject({ gatewayId: 'gw-1', provider: 'NordVPN', method: 'dns-pattern', detail: 'nordvpn.com' });
  });

  it('skips the createMany call entirely when every detection is for an unknown device', async () => {
    const prisma = buildPrisma({ device: { findMany: jest.fn().mockResolvedValue([]) } });
    const service = new GatewayService(prisma, buildAudit());

    const result = await service.recordVpnDetections('gw-1', [
      { deviceId: 'ghost-device', provider: 'Surfshark', method: 'dns-pattern' },
    ]);

    expect(result).toEqual({ recorded: 0 });
    expect(prisma.vpnDetectionLog.createMany).not.toHaveBeenCalled();
  });
});
