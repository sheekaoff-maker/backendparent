import { GatewayService } from '../src/gateway/gateway.service';
import { NotFoundException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1' }),
      ...overrides.gateway,
    },
    device: {
      findMany: jest.fn().mockResolvedValue([{ id: 'dev-1' }, { id: 'dev-2' }]),
      ...overrides.device,
    },
  } as any;
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

describe('GatewayService.recordDohDetections', () => {
  it('returns immediately without touching prisma when there is nothing to record', async () => {
    const prisma = buildPrisma();
    const audit = buildAudit();
    const service = new GatewayService(prisma, audit as any);

    const result = await service.recordDohDetections('gw-1', []);

    expect(result).toEqual({ recorded: 0 });
    expect(prisma.gateway.findUnique).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('throws when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new GatewayService(prisma, buildAudit() as any);

    await expect(
      service.recordDohDetections('missing-gw', [{ deviceId: 'dev-1', provider: 'Cloudflare', method: 'conntrack-port-853' }]),
    ).rejects.toThrow(NotFoundException);
  });

  it('audit-logs detections only for devices that actually belong to this gateway', async () => {
    const prisma = buildPrisma();
    const audit = buildAudit();
    const service = new GatewayService(prisma, audit as any);

    const result = await service.recordDohDetections('gw-1', [
      { deviceId: 'dev-1', provider: 'DoT', method: 'conntrack-port-853', detail: '853' },
      { deviceId: 'dev-2', provider: 'Cloudflare', method: 'conntrack-doh-ip', detail: '1.1.1.1' },
      { deviceId: 'not-on-this-gateway', provider: 'Google', method: 'conntrack-doh-ip' },
    ]);

    expect(result).toEqual({ recorded: 2 });
    expect(audit.log).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'doh_dot_detected',
        entity: 'device',
        entityId: 'dev-1',
        details: expect.stringContaining('"provider":"DoT"'),
      }),
    );
  });

  it('skips audit-logging entirely when every detection is for an unknown device', async () => {
    const prisma = buildPrisma({ device: { findMany: jest.fn().mockResolvedValue([]) } });
    const audit = buildAudit();
    const service = new GatewayService(prisma, audit as any);

    const result = await service.recordDohDetections('gw-1', [
      { deviceId: 'ghost-device', provider: 'Quad9', method: 'conntrack-doh-ip' },
    ]);

    expect(result).toEqual({ recorded: 0 });
    expect(audit.log).not.toHaveBeenCalled();
  });
});
