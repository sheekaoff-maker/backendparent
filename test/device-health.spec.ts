import {
  evaluateDeviceHealth,
  FRESH_THRESHOLD_MINUTES,
} from '../src/device-health/device-health.types';

const NOW = new Date('2026-07-16T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe('evaluateDeviceHealth', () => {
  it('NOT_CONFIGURED when never seen and not configured', () => {
    const v = evaluateDeviceHealth(
      { dnsConfigured: false, lastDnsSeenAt: null, internetLocked: false, hasActiveSession: false },
      NOW,
    );
    expect(v.state).toBe('NOT_CONFIGURED');
    expect(v.filteringActive).toBe(false);
    expect(v.ageMinutes).toBeNull();
  });

  it('NEVER_VERIFIED when configured but never seen', () => {
    const v = evaluateDeviceHealth(
      { dnsConfigured: true, lastDnsSeenAt: null, internetLocked: false, hasActiveSession: false },
      NOW,
    );
    expect(v.state).toBe('NEVER_VERIFIED');
    expect(v.severity).toBe('warning');
    expect(v.recommendedAction).not.toBeNull();
  });

  it('VERIFIED when DNS seen within the fresh window', () => {
    const v = evaluateDeviceHealth(
      {
        dnsConfigured: true,
        lastDnsSeenAt: minutesAgo(FRESH_THRESHOLD_MINUTES - 1),
        internetLocked: false,
        hasActiveSession: false,
      },
      NOW,
    );
    expect(v.state).toBe('VERIFIED');
    expect(v.filteringActive).toBe(true);
    expect(v.severity).toBe('ok');
  });

  it('IDLE when stale and not in use (device likely off) — not an error', () => {
    const v = evaluateDeviceHealth(
      {
        dnsConfigured: true,
        lastDnsSeenAt: minutesAgo(180),
        internetLocked: false,
        hasActiveSession: false,
      },
      NOW,
    );
    expect(v.state).toBe('IDLE');
    expect(v.severity).toBe('info');
  });

  it('NEEDS_ATTENTION when locked but DNS is silent (possible bypass)', () => {
    const v = evaluateDeviceHealth(
      {
        dnsConfigured: true,
        lastDnsSeenAt: minutesAgo(60),
        internetLocked: true,
        hasActiveSession: false,
      },
      NOW,
    );
    expect(v.state).toBe('NEEDS_ATTENTION');
    expect(v.filteringActive).toBe(false);
    expect(v.severity).toBe('warning');
  });

  it('NEEDS_ATTENTION when a session is active but DNS is silent', () => {
    const v = evaluateDeviceHealth(
      {
        dnsConfigured: true,
        lastDnsSeenAt: minutesAgo(45),
        internetLocked: false,
        hasActiveSession: true,
      },
      NOW,
    );
    expect(v.state).toBe('NEEDS_ATTENTION');
  });

  it('clamps a future heartbeat to age 0 and treats it as VERIFIED', () => {
    const v = evaluateDeviceHealth(
      {
        dnsConfigured: true,
        lastDnsSeenAt: new Date(NOW.getTime() + 5_000),
        internetLocked: false,
        hasActiveSession: false,
      },
      NOW,
    );
    expect(v.ageMinutes).toBe(0);
    expect(v.state).toBe('VERIFIED');
  });
});
