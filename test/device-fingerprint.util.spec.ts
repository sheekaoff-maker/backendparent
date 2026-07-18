import { computeFingerprintHash } from '../src/gateway/device-fingerprint.util';

describe('computeFingerprintHash', () => {
  it('is deterministic for identical input', () => {
    const input = { macAddress: 'AA:BB:CC:DD:EE:FF', hostname: 'iphone-13', dhcpClientId: 'abc123', vendorOui: 'Apple' };
    expect(computeFingerprintHash(input)).toBe(computeFingerprintHash({ ...input }));
  });

  it('is case-insensitive and trims whitespace', () => {
    const a = computeFingerprintHash({ macAddress: 'AA:BB:CC:DD:EE:FF', hostname: ' iPhone-13 ' });
    const b = computeFingerprintHash({ macAddress: 'aa:bb:cc:dd:ee:ff', hostname: 'iphone-13' });
    expect(a).toBe(b);
  });

  it('changes when the MAC address changes', () => {
    const a = computeFingerprintHash({ macAddress: 'AA:BB:CC:DD:EE:FF', hostname: 'iphone-13' });
    const b = computeFingerprintHash({ macAddress: 'AA:BB:CC:DD:EE:00', hostname: 'iphone-13' });
    expect(a).not.toBe(b);
  });

  it('changes when hostname, dhcpClientId, or vendorOui changes', () => {
    const base = { macAddress: 'AA:BB:CC:DD:EE:FF', hostname: 'iphone-13', dhcpClientId: 'abc', vendorOui: 'Apple' };
    expect(computeFingerprintHash(base)).not.toBe(computeFingerprintHash({ ...base, hostname: 'iphone-14' }));
    expect(computeFingerprintHash(base)).not.toBe(computeFingerprintHash({ ...base, dhcpClientId: 'xyz' }));
    expect(computeFingerprintHash(base)).not.toBe(computeFingerprintHash({ ...base, vendorOui: 'Samsung' }));
  });

  it('treats missing fields as empty, not as distinguishing from explicit null/undefined', () => {
    const a = computeFingerprintHash({ macAddress: 'AA:BB:CC:DD:EE:FF' });
    const b = computeFingerprintHash({ macAddress: 'AA:BB:CC:DD:EE:FF', hostname: null, dhcpClientId: undefined });
    expect(a).toBe(b);
  });

  it('produces a 64-char hex sha256 digest', () => {
    const hash = computeFingerprintHash({ macAddress: 'AA:BB:CC:DD:EE:FF' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
