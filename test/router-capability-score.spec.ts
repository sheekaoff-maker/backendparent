import { RouterCapabilityScoreService } from '../src/router-integration/router-capability-score.service';
import { RouterCapabilities } from '../src/router-integration/router-capability.matrix';

function fullCapabilities(overrides: Partial<RouterCapabilities> = {}): RouterCapabilities {
  return {
    pluginId: 'mikrotik',
    vendorDisplayName: 'MikroTik',
    modelFamily: 'RouterOS',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'RouterOS-REST',
    officialDocUrl: 'https://help.mikrotik.com',
    scopeNote: null,
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsStatistics: true,
    supportsParentalControl: false,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: true,
    supportsTR064: false,
    supportsRouterOS: true,
    supportedAuthentication: ['http-basic-auth'],
    ...overrides,
  };
}

function guideOnlyCapabilities(overrides: Partial<RouterCapabilities> = {}): RouterCapabilities {
  return {
    pluginId: 'netgear',
    vendorDisplayName: 'Netgear',
    modelFamily: null,
    integrationStatus: 'GUIDE_ONLY',
    pluginImplemented: false,
    protocol: null,
    officialDocUrl: null,
    scopeNote: null,
    supportsDNSChange: false,
    supportsFirewallRules: false,
    supportsPauseDevice: false,
    supportsClientDisconnect: false,
    supportsQoS: false,
    supportsStatistics: false,
    supportsParentalControl: false,
    supportsACL: false,
    supportsMACFiltering: false,
    supportsAPI: false,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: [],
    ...overrides,
  };
}

describe('RouterCapabilityScoreService', () => {
  const service = new RouterCapabilityScoreService();

  it('scores an undetected router (capabilities: null) as UNSUPPORTED with 0 stars', () => {
    const result = service.computeScore(null);
    expect(result.score).toBe(0);
    expect(result.level).toBe('UNSUPPORTED');
    expect(result.stars).toBe(0);
    expect(result.badge).toBe('☆☆☆☆☆ Unsupported');
    expect(result.recommendations[0]).toMatch(/run router detection/i);
  });

  it('scores a GUIDE_ONLY vendor as BASIC — every enforcement flag is false, but device discovery still runs (gateway-agent side, independent of vendor)', () => {
    const result = service.computeScore(guideOnlyCapabilities());
    expect(result.score).toBe(5);
    expect(result.level).toBe('BASIC');
    expect(result.supportedFeatures).toEqual(['Device Discovery']);
    expect(result.unsupportedFeatures).toContain('Pause Device');
  });

  it('scores a fully-capable OFFICIAL_API router (MikroTik minus parental control) as FULL_SUPPORT', () => {
    // pauseDevice(25) + accessSchedule(20) + blockDevice(15) + dns(15) + statistics(10)
    // + deviceDiscovery(5) = 90; parentalControls(10) and firmwareDetection(5) unsupported.
    const result = service.computeScore(fullCapabilities());
    expect(result.score).toBe(90);
    expect(result.level).toBe('FULL_SUPPORT');
    expect(result.stars).toBe(5);
    expect(result.badge).toBe('★★★★★ Full Support');
    expect(result.supportedFeatures).toContain('Pause Device');
    expect(result.unsupportedFeatures).toContain('Parental Controls');
  });

  it('awards Firmware Detection only when this specific router instance reported one', () => {
    const withFirmware = service.computeScore(fullCapabilities(), { firmwareVersion: '7.15' });
    const withoutFirmware = service.computeScore(fullCapabilities(), { firmwareVersion: null });

    expect(withFirmware.score).toBe(95);
    expect(withFirmware.supportedFeatures).toContain('Firmware Detection');
    expect(withoutFirmware.score).toBe(90);
    expect(withoutFirmware.unsupportedFeatures).toContain('Firmware Detection');
  });

  it('never awards Access Schedule or Block Device points from DNS-change alone (DNS is a distinct, separately-weighted category)', () => {
    const dnsOnly = guideOnlyCapabilities({
      integrationStatus: 'OFFICIAL_API',
      supportsDNSChange: true,
    });
    const result = service.computeScore(dnsOnly);
    // dnsFiltering(15) + deviceDiscovery(5, since capabilities is non-null) = 20
    expect(result.score).toBe(20);
    expect(result.level).toBe('LIMITED');
    expect(result.supportedFeatures).toEqual(['DNS Filtering', 'Device Discovery']);
  });

  it('computes a mid-tier GOOD score for a router with only firewall + MAC filtering', () => {
    const midTier = guideOnlyCapabilities({
      integrationStatus: 'OFFICIAL_API',
      supportsFirewallRules: true,
      supportsMACFiltering: true,
    });
    // accessSchedule(20) + blockDevice(15) + deviceDiscovery(5) = 40 -> LIMITED (20-44 band)
    const result = service.computeScore(midTier);
    expect(result.score).toBe(40);
    expect(result.level).toBe('LIMITED');
  });

  it('recommends a Software Gateway when no pause/block mechanism exists at all', () => {
    const dnsOnly = guideOnlyCapabilities({ integrationStatus: 'OFFICIAL_API', supportsDNSChange: true });
    const result = service.computeScore(dnsOnly);
    expect(result.recommendations.some((r) => /Software Gateway/i.test(r))).toBe(true);
  });

  it('surfaces the real vendor scopeNote as a recommendation for GUIDE_ONLY vendors', () => {
    const result = service.computeScore(
      guideOnlyCapabilities({ scopeNote: 'Consumer line — see zyxel_nebula for Nebula-managed devices.' }),
    );
    expect(result.recommendations).toContain('Consumer line — see zyxel_nebula for Nebula-managed devices.');
  });

  it('breakdown lists all 8 categories, and the final score never exceeds the 100 ceiling even though weights sum to 105', () => {
    const result = service.computeScore(fullCapabilities({ supportsParentalControl: true }), { firmwareVersion: '7.15' });
    expect(result.breakdown).toHaveLength(8);
    expect(result.breakdown.reduce((sum, c) => sum + c.weight, 0)).toBe(105);
    expect(result.score).toBe(100);
    expect(result.maxScore).toBe(100);
  });
});
