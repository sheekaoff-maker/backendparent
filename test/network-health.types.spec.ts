import { computeNetworkHealth, NetworkHealthInput } from '../src/device-health/network-health.types';

function baseInput(overrides: Partial<NetworkHealthInput> = {}): NetworkHealthInput {
  return {
    dns: { total: 10, protectedCount: 10 },
    router: { tested: 2, healthy: 2, anyGateway: true },
    plugin: { considered: 10, succeeded: 10 },
    vpnDetections24h: 0,
    bypassSuspectedDeviceCount: 0,
    dohDetections24h: 0,
    devicesOnline: 10,
    devicesTotal: 10,
    lastSynchronization: new Date('2026-07-21T12:00:00Z'),
    ...overrides,
  };
}

describe('computeNetworkHealth', () => {
  it('scores a fully healthy household at 100% overall, green', () => {
    const result = computeNetworkHealth(baseInput());
    expect(result.overallProtection).toBe(100);
    expect(result.overallColor).toBe('green');
    expect(result.dns.state).toBe('Healthy');
    expect(result.router.state).toBe('Healthy');
    expect(result.plugin.state).toBe('Healthy');
    expect(result.security.state).toBe('Healthy');
    expect(result.networkStability.state).toBe('Stable');
  });

  it('reports DNS as Not Configured (grey) and excludes it from the overall weighting when there are no devices', () => {
    const result = computeNetworkHealth(baseInput({ dns: { total: 0, protectedCount: 0 } }));
    expect(result.dns.color).toBe('grey');
    expect(result.dns.percent).toBeNull();
    // Overall should still be computable from the other real sections, not zeroed out by the missing one.
    expect(result.overallProtection).toBeGreaterThan(0);
  });

  it('reports Router as Not Configured when there is no gateway at all', () => {
    const result = computeNetworkHealth(baseInput({ router: { tested: 0, healthy: 0, anyGateway: false } }));
    expect(result.router.state).toBe('Not Configured');
    expect(result.router.color).toBe('grey');
  });

  it('reports Router as Not Tested (distinct from Not Configured) when a gateway exists but has never been tested', () => {
    const result = computeNetworkHealth(baseInput({ router: { tested: 0, healthy: 0, anyGateway: true } }));
    expect(result.router.state).toBe('Not Tested');
    expect(result.router.color).toBe('grey');
  });

  it('flags VPN as Detected (yellow) when recent detections exist, Not Detected (green) otherwise', () => {
    const detected = computeNetworkHealth(baseInput({ vpnDetections24h: 3 }));
    expect(detected.vpn.state).toBe('Detected');
    expect(detected.vpn.color).toBe('yellow');

    const clean = computeNetworkHealth(baseInput({ vpnDetections24h: 0 }));
    expect(clean.vpn.state).toBe('Not Detected');
    expect(clean.vpn.color).toBe('green');
  });

  it('flags Private DNS as Bypass Suspected (red) when any device is flagged, Disabled (green) otherwise', () => {
    const suspected = computeNetworkHealth(baseInput({ bypassSuspectedDeviceCount: 2 }));
    expect(suspected.privateDns.state).toBe('Bypass Suspected');
    expect(suspected.privateDns.color).toBe('red');

    const clean = computeNetworkHealth(baseInput({ bypassSuspectedDeviceCount: 0 }));
    expect(clean.privateDns.state).toBe('Disabled');
    expect(clean.privateDns.color).toBe('green');
  });

  it('flags DoH as Detected (yellow) vs Clean (green)', () => {
    const detected = computeNetworkHealth(baseInput({ dohDetections24h: 1 }));
    expect(detected.doh.state).toBe('Detected');

    const clean = computeNetworkHealth(baseInput({ dohDetections24h: 0 }));
    expect(clean.doh.state).toBe('Clean');
  });

  it('drags the overall score down when router health is poor, and reports the right color band', () => {
    const result = computeNetworkHealth(baseInput({ router: { tested: 4, healthy: 1, anyGateway: true } }));
    expect(result.router.percent).toBe(25);
    expect(result.router.color).toBe('red');
    expect(result.overallProtection).toBeLessThan(100);
  });

  it('reports Network Stability as Not Configured (grey, excluded from weighting) when there are no devices at all', () => {
    const result = computeNetworkHealth(baseInput({ devicesOnline: 0, devicesTotal: 0, dns: { total: 0, protectedCount: 0 } }));
    expect(result.networkStability.state).toBe('Not Configured');
    expect(result.networkStability.percent).toBeNull();
  });

  it('never divides by zero / returns NaN when DNS, router, plugin, and stability are all unconfigured — Security (always computable, even with zero data) carries the overall score', () => {
    const result = computeNetworkHealth(
      baseInput({
        dns: { total: 0, protectedCount: 0 },
        router: { tested: 0, healthy: 0, anyGateway: false },
        plugin: { considered: 0, succeeded: 0 },
        devicesOnline: 0,
        devicesTotal: 0,
      }),
    );
    expect(Number.isNaN(result.overallProtection)).toBe(false);
    // No VPN/bypass/DoH detections were reported either, so Security is
    // honestly 100 ("nothing bad seen"), and it's the only weighted section
    // left standing — that's a real, defensible score, not a fabricated one.
    expect(result.overallProtection).toBe(100);
  });

  it('surfaces the real last-synchronization timestamp, or null when there is no gateway', () => {
    const withSync = computeNetworkHealth(baseInput({ lastSynchronization: new Date('2026-07-21T12:00:00Z') }));
    expect(withSync.lastSynchronization).toBe('2026-07-21T12:00:00.000Z');

    const withoutSync = computeNetworkHealth(baseInput({ lastSynchronization: null }));
    expect(withoutSync.lastSynchronization).toBeNull();
  });
});
