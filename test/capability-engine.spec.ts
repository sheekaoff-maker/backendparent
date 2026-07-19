import { CapabilityEngineService } from '../src/router-integration/capability-engine.service';
import { RouterDatabaseService } from '../src/router-integration/router-database.service';

describe('CapabilityEngineService', () => {
  const service = new CapabilityEngineService(new RouterDatabaseService());

  it('reports supported flags correctly for a known pluginId', () => {
    expect(service.isSupported('mikrotik', 'supportsClientDisconnect')).toBe(true);
    expect(service.isSupported('mikrotik', 'supportsParentalControl')).toBe(false);
  });

  it('reports every flag false for a guide-only pluginId', () => {
    expect(service.isSupported('netgear', 'supportsDNSChange')).toBe(false);
    expect(service.isSupported('netgear', 'supportsFirewallRules')).toBe(false);
  });

  it('reports every flag false for a null/undefined pluginId (undetected router)', () => {
    expect(service.isSupported(null, 'supportsPauseDevice')).toBe(false);
    expect(service.isSupported(undefined, 'supportsPauseDevice')).toBe(false);
  });

  it('reports every flag false for an unrecognized pluginId', () => {
    expect(service.isSupported('not-a-real-plugin', 'supportsPauseDevice')).toBe(false);
  });

  it('getCapabilities returns the full entry for a known pluginId and null otherwise', () => {
    expect(service.getCapabilities('fritzbox')?.protocol).toBe('TR-064');
    expect(service.getCapabilities(null)).toBeNull();
    expect(service.getCapabilities('nope')).toBeNull();
  });
});
