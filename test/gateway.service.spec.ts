import { GatewayService } from '../src/gateway/gateway.service';
import { computeFingerprintHash } from '../src/gateway/device-fingerprint.util';
import { NotFoundException } from '@nestjs/common';

function buildPrisma(overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gw-1' }),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.gateway,
    },
    device: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.device,
    },
  } as any;
}

describe('GatewayService.updateDiscoveredDevices', () => {
  it('throws when the gateway does not exist', async () => {
    const prisma = buildPrisma({ gateway: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new GatewayService(prisma);

    await expect(service.updateDiscoveredDevices('missing-gw', [])).rejects.toThrow(NotFoundException);
  });

  it('updates the matching device by MAC (unchanged pairing behaviour) and stamps a fingerprint hash', async () => {
    const existing = { id: 'dev-1', macAddress: '11:22:33:44:55:66', hostname: null, dhcpClientId: null, vendorOui: null };
    const prisma = buildPrisma({ device: { findFirst: jest.fn().mockResolvedValue(existing) } });
    const service = new GatewayService(prisma);

    const result = await service.updateDiscoveredDevices('gw-1', [
      { ipAddress: '192.168.1.50', macAddress: '11:22:33:44:55:66', hostname: 'iphone-13', vendorOui: 'Apple' },
    ]);

    expect(result).toEqual({ updated: 1 });
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { gatewayId: 'gw-1', macAddress: '11:22:33:44:55:66' },
    });

    const updateArg = prisma.device.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'dev-1' });
    expect(updateArg.data.ipAddress).toBe('192.168.1.50');
    expect(updateArg.data.dnsSourceIp).toBe('192.168.1.50');
    expect(updateArg.data.hostname).toBe('iphone-13');
    expect(updateArg.data.vendorOui).toBe('Apple');
    expect(updateArg.data.fingerprintHash).toBe(
      computeFingerprintHash({
        macAddress: '11:22:33:44:55:66',
        hostname: 'iphone-13',
        dhcpClientId: null,
        vendorOui: 'Apple',
      }),
    );
  });

  it('merges into an existing device when the MAC differs but hostname + DHCP client id match (MAC randomization)', async () => {
    const knownDevice = {
      id: 'dev-known',
      macAddress: 'aa:aa:aa:aa:aa:aa',
      hostname: 'pixel-8',
      dhcpClientId: 'client-xyz',
      vendorOui: 'Google',
    };
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null) // primary MAC lookup misses
      .mockResolvedValueOnce(knownDevice); // secondary hostname+dhcpClientId lookup hits
    const prisma = buildPrisma({ device: { findFirst } });
    const service = new GatewayService(prisma);

    const result = await service.updateDiscoveredDevices('gw-1', [
      {
        ipAddress: '192.168.1.77',
        macAddress: 'bb:bb:bb:bb:bb:bb', // randomized MAC, different from stored one
        hostname: 'pixel-8',
        dhcpClientId: 'client-xyz',
        vendorOui: 'Google',
      },
    ]);

    expect(result).toEqual({ updated: 1 });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { gatewayId: 'gw-1', hostname: 'pixel-8', dhcpClientId: 'client-xyz' },
    });

    const updateArg = prisma.device.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'dev-known' });
    expect(updateArg.data.macAddress).toBe('bb:bb:bb:bb:bb:bb');
  });

  it('skips a discovered device that matches nothing (no premature device creation)', async () => {
    const prisma = buildPrisma();
    const service = new GatewayService(prisma);

    const result = await service.updateDiscoveredDevices('gw-1', [
      { ipAddress: '192.168.1.99', macAddress: 'ff:ff:ff:ff:ff:ff' },
    ]);

    expect(result).toEqual({ updated: 0 });
    expect(prisma.device.update).not.toHaveBeenCalled();
  });
});
