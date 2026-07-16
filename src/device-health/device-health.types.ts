/**
 * Device protection-health verdict.
 *
 * The product filters via DNS and fails OPEN — if a device stops sending DNS
 * queries through us, filtering silently stops. This verdict turns the raw
 * `lastDnsSeenAt` heartbeat into an honest, actionable status for parents,
 * without crying "broken" for a device that is simply powered off.
 */
export type DeviceHealthState =
  | 'VERIFIED' // DNS traffic seen recently — filtering is confirmed active
  | 'IDLE' // configured and seen before, but quiet (device likely off / not online)
  | 'NEEDS_ATTENTION' // in active use but DNS is NOT reaching us — likely bypass/misconfig
  | 'NEVER_VERIFIED' // set up, but we have never seen DNS traffic from it
  | 'NOT_CONFIGURED'; // DNS setup not done yet

export type HealthSeverity = 'ok' | 'info' | 'warning';

export interface DeviceHealthInput {
  dnsConfigured: boolean;
  lastDnsSeenAt: Date | null;
  internetLocked: boolean;
  /** True when the device has a live session (a strong signal it's in use). */
  hasActiveSession: boolean;
}

export interface DeviceHealthVerdict {
  state: DeviceHealthState;
  severity: HealthSeverity;
  /** Whether we can currently confirm filtering is reaching this device. */
  filteringActive: boolean;
  title: string;
  message: string;
  recommendedAction: string | null;
  lastDnsSeenAt: Date | null;
  /** Minutes since the last DNS heartbeat, or null if never seen. */
  ageMinutes: number | null;
}

/** DNS heartbeat is considered "fresh" within this window. */
export const FRESH_THRESHOLD_MINUTES = 15;

/**
 * Pure verdict function — no I/O, fully unit-testable. Given the device's
 * current signals and "now", returns an honest health verdict.
 */
export function evaluateDeviceHealth(
  input: DeviceHealthInput,
  now: Date = new Date(),
): DeviceHealthVerdict {
  const { dnsConfigured, lastDnsSeenAt, internetLocked, hasActiveSession } = input;

  const ageMinutes =
    lastDnsSeenAt === null
      ? null
      : Math.max(0, Math.floor((now.getTime() - lastDnsSeenAt.getTime()) / 60_000));

  const base = { lastDnsSeenAt, ageMinutes };

  if (lastDnsSeenAt === null) {
    if (!dnsConfigured) {
      return {
        ...base,
        state: 'NOT_CONFIGURED',
        severity: 'info',
        filteringActive: false,
        title: 'Not set up yet',
        message: 'DNS filtering has not been configured for this device.',
        recommendedAction: 'Run the DNS setup guide',
      };
    }
    return {
      ...base,
      state: 'NEVER_VERIFIED',
      severity: 'warning',
      filteringActive: false,
      title: 'Never verified',
      message:
        'This device is marked as configured, but we have never seen DNS traffic from it. The DNS may be set incorrectly.',
      recommendedAction: 'Re-check the DNS setup and run a verification',
    };
  }

  if (ageMinutes !== null && ageMinutes <= FRESH_THRESHOLD_MINUTES) {
    return {
      ...base,
      state: 'VERIFIED',
      severity: 'ok',
      filteringActive: true,
      title: 'Protected',
      message: 'DNS filtering is active — we saw traffic from this device just now.',
      recommendedAction: null,
    };
  }

  // Stale heartbeat. If the device shows signs of being in use, that is a real
  // problem (in use but not filtering). Otherwise it is probably just idle/off.
  if (internetLocked || hasActiveSession) {
    return {
      ...base,
      state: 'NEEDS_ATTENTION',
      severity: 'warning',
      filteringActive: false,
      title: 'Needs attention',
      message: internetLocked
        ? 'This device is locked but no DNS traffic is reaching us. The child may have changed DNS, started a VPN, or switched to a hotspot.'
        : 'A session is active but no DNS traffic is reaching us — filtering may be bypassed.',
      recommendedAction: 'Check router DNS, private DNS, and for a VPN or hotspot',
    };
  }

  return {
    ...base,
    state: 'IDLE',
    severity: 'info',
    filteringActive: false,
    title: 'Idle',
    message:
      'No recent DNS traffic. The device is likely powered off or not currently online. Filtering resumes automatically when it reconnects.',
    recommendedAction: null,
  };
}
