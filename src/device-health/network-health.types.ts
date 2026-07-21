/**
 * Network Health Score — a household-wide rollup, distinct from
 * DeviceHealthService (which is per-device DNS-filtering verification).
 * Every section here reads a REAL, already-tracked signal:
 *   - DNS          -> DeviceHealthService's own protectedCount/total ratio
 *   - Router       -> DetectedRouter.lastTestResult across the parent's gateways
 *   - Plugin       -> RouterCommand status (ACKNOWLEDGED vs FAILED) recency
 *   - VPN          -> VpnDetectionLog rows in the last 24h
 *   - Private DNS  -> Device.protectionStatus (POSSIBLE_DNS_BYPASS/COMPROMISED
 *                     is exactly what a device switching to its own private/
 *                     encrypted DNS resolver looks like from here)
 *   - DoH          -> AuditLog 'doh_dot_detected' rows in the last 24h
 *   - Stability    -> Device.status (ONLINE) ratio
 *   - Last Sync    -> max(Gateway.lastSeen)
 * Nothing here is a fabricated number — a signal with no data yet reports
 * `NOT_CONFIGURED` (grey) and is excluded from the weighted overall score
 * rather than being guessed.
 */

export type HealthColor = 'green' | 'yellow' | 'red' | 'grey';

export interface HealthSection {
  label: string;
  state: string;
  color: HealthColor;
  /** 0-100, or null when there is nothing yet to measure (excluded from the overall weighted average). */
  percent: number | null;
  detail: string;
}

export interface NetworkHealthInput {
  dns: { total: number; protectedCount: number };
  router: { tested: number; healthy: number; anyGateway: boolean };
  plugin: { considered: number; succeeded: number };
  vpnDetections24h: number;
  bypassSuspectedDeviceCount: number;
  dohDetections24h: number;
  devicesOnline: number;
  devicesTotal: number;
  lastSynchronization: Date | null;
}

export interface NetworkHealthSummary {
  generatedAt: string;
  overallProtection: number;
  overallColor: HealthColor;
  router: HealthSection;
  dns: HealthSection;
  plugin: HealthSection;
  security: HealthSection;
  vpn: HealthSection;
  privateDns: HealthSection;
  doh: HealthSection;
  networkStability: HealthSection;
  lastSynchronization: string | null;
}

function colorForPercent(percent: number): HealthColor {
  if (percent >= 80) return 'green';
  if (percent >= 50) return 'yellow';
  return 'red';
}

export function computeNetworkHealth(input: NetworkHealthInput, now: Date = new Date()): NetworkHealthSummary {
  const sections: { section: HealthSection; weight: number }[] = [];

  // DNS Health
  const dnsPercent = input.dns.total > 0 ? Math.round((input.dns.protectedCount / input.dns.total) * 100) : null;
  const dns: HealthSection =
    dnsPercent === null
      ? { label: 'DNS', state: 'Not Configured', color: 'grey', percent: null, detail: 'No devices set up for DNS filtering yet.' }
      : {
          label: 'DNS',
          state: dnsPercent >= 80 ? 'Healthy' : dnsPercent >= 50 ? 'Degraded' : 'Needs Attention',
          color: colorForPercent(dnsPercent),
          percent: dnsPercent,
          detail: `${input.dns.protectedCount}/${input.dns.total} devices confirmed filtering.`,
        };
  if (dnsPercent !== null) sections.push({ section: dns, weight: 30 });

  // Router Health
  const routerPercent = input.router.tested > 0 ? Math.round((input.router.healthy / input.router.tested) * 100) : null;
  const router: HealthSection =
    !input.router.anyGateway
      ? { label: 'Router', state: 'Not Configured', color: 'grey', percent: null, detail: 'No gateway added yet.' }
      : routerPercent === null
        ? { label: 'Router', state: 'Not Tested', color: 'grey', percent: null, detail: 'Router connection has not been tested yet.' }
        : {
            label: 'Router',
            state: routerPercent >= 80 ? 'Healthy' : routerPercent >= 50 ? 'Degraded' : 'Needs Attention',
            color: colorForPercent(routerPercent),
            percent: routerPercent,
            detail: `${input.router.healthy}/${input.router.tested} router(s) passing their last connection test.`,
          };
  if (routerPercent !== null) sections.push({ section: router, weight: 20 });

  // Plugin (Enforcement Engine) Health
  const pluginPercent = input.plugin.considered > 0 ? Math.round((input.plugin.succeeded / input.plugin.considered) * 100) : null;
  const plugin: HealthSection =
    pluginPercent === null
      ? { label: 'Plugin', state: 'No Recent Activity', color: 'grey', percent: null, detail: 'No enforcement commands sent recently.' }
      : {
          label: 'Plugin',
          state: pluginPercent >= 80 ? 'Healthy' : pluginPercent >= 50 ? 'Degraded' : 'Needs Attention',
          color: colorForPercent(pluginPercent),
          percent: pluginPercent,
          detail: `${input.plugin.succeeded}/${input.plugin.considered} recent enforcement commands acknowledged successfully.`,
        };
  if (pluginPercent !== null) sections.push({ section: plugin, weight: 15 });

  // VPN Status
  const vpn: HealthSection =
    input.vpnDetections24h > 0
      ? { label: 'VPN', state: 'Detected', color: 'yellow', percent: 60, detail: `${input.vpnDetections24h} VPN detection(s) in the last 24h.` }
      : { label: 'VPN', state: 'Not Detected', color: 'green', percent: 100, detail: 'No VPN use detected in the last 24h.' };

  // Private DNS Status (device switched away from the assigned resolver)
  const privateDns: HealthSection =
    input.bypassSuspectedDeviceCount > 0
      ? {
          label: 'Private DNS',
          state: 'Bypass Suspected',
          color: 'red',
          percent: 30,
          detail: `${input.bypassSuspectedDeviceCount} device(s) flagged for a possible DNS bypass.`,
        }
      : { label: 'Private DNS', state: 'Disabled', color: 'green', percent: 100, detail: 'No devices are bypassing the assigned DNS resolver.' };

  // DoH Status
  const doh: HealthSection =
    input.dohDetections24h > 0
      ? { label: 'DoH', state: 'Detected', color: 'yellow', percent: 60, detail: `${input.dohDetections24h} DoH/DoT detection(s) in the last 24h.` }
      : { label: 'DoH', state: 'Clean', color: 'green', percent: 100, detail: 'No encrypted-DNS bypass attempts detected in the last 24h.' };

  const securityPercent = Math.round(((vpn.percent ?? 0) + (privateDns.percent ?? 0) + (doh.percent ?? 0)) / 3);
  const security: HealthSection = {
    label: 'Security',
    state: securityPercent >= 80 ? 'Healthy' : securityPercent >= 50 ? 'Monitor' : 'At Risk',
    color: colorForPercent(securityPercent),
    percent: securityPercent,
    detail: 'VPN, Private DNS, and DoH bypass signals combined.',
  };
  sections.push({ section: security, weight: 20 });

  // Network Stability (Internet Reachability)
  const stabilityPercent = input.devicesTotal > 0 ? Math.round((input.devicesOnline / input.devicesTotal) * 100) : null;
  const networkStability: HealthSection =
    stabilityPercent === null
      ? { label: 'Network Stability', state: 'Not Configured', color: 'grey', percent: null, detail: 'No devices registered yet.' }
      : {
          label: 'Network Stability',
          state: stabilityPercent >= 80 ? 'Stable' : stabilityPercent >= 50 ? 'Unstable' : 'Unreachable',
          color: colorForPercent(stabilityPercent),
          percent: stabilityPercent,
          detail: `${input.devicesOnline}/${input.devicesTotal} devices currently online.`,
        };
  if (stabilityPercent !== null) sections.push({ section: networkStability, weight: 15 });

  const totalWeight = sections.reduce((sum, s) => sum + s.weight, 0);
  const overallProtection =
    totalWeight > 0
      ? Math.round(sections.reduce((sum, s) => sum + (s.section.percent ?? 0) * s.weight, 0) / totalWeight)
      : 0;

  return {
    generatedAt: now.toISOString(),
    overallProtection,
    overallColor: colorForPercent(overallProtection),
    router,
    dns,
    plugin,
    security,
    vpn,
    privateDns,
    doh,
    networkStability,
    lastSynchronization: input.lastSynchronization ? input.lastSynchronization.toISOString() : null,
  };
}
