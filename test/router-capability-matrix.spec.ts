import { ROUTER_CAPABILITY_MATRIX } from '../src/router-integration/router-capability.matrix';

describe('ROUTER_CAPABILITY_MATRIX', () => {
  const entries = Object.entries(ROUTER_CAPABILITY_MATRIX);

  it('has exactly 36 rows (11 official-API + 25 guide-only)', () => {
    expect(entries).toHaveLength(36);
  });

  it('every OFFICIAL_API row cites a real doc URL and a protocol', () => {
    for (const [, entry] of entries) {
      if (entry.integrationStatus === 'OFFICIAL_API') {
        expect(entry.officialDocUrl).toBeTruthy();
        expect(entry.protocol).toBeTruthy();
        expect(entry.officialDocUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it('every GUIDE_ONLY row has no doc URL, no protocol, and every capability flag false', () => {
    for (const [, entry] of entries) {
      if (entry.integrationStatus === 'GUIDE_ONLY') {
        expect(entry.officialDocUrl).toBeNull();
        expect(entry.protocol).toBeNull();
        expect(entry.pluginImplemented).toBe(false);
        expect(entry.supportsAPI).toBe(false);
        expect(entry.supportedAuthentication).toEqual([]);
      }
    }
  });

  it('pluginImplemented is true only for the 11 real plugins', () => {
    const implemented = entries.filter(([, e]) => e.pluginImplemented).map(([id]) => id).sort();
    expect(implemented).toEqual(
      ['draytek', 'edgerouter', 'fritzbox', 'glinet', 'keenetic', 'linksys', 'mikrotik', 'openwrt', 'tplink_omada', 'unifi', 'zyxel_nebula'].sort(),
    );
  });

  it('a pluginImplemented row is never GUIDE_ONLY', () => {
    for (const [, entry] of entries) {
      if (entry.pluginImplemented) {
        expect(entry.integrationStatus).toBe('OFFICIAL_API');
      }
    }
  });

  it('every row key matches its own pluginId field', () => {
    for (const [key, entry] of entries) {
      expect(entry.pluginId).toBe(key);
    }
  });

  it('TP-Link and Zyxel each have a scoped real row and a guide-only fallback row', () => {
    expect(ROUTER_CAPABILITY_MATRIX.tplink_omada.integrationStatus).toBe('OFFICIAL_API');
    expect(ROUTER_CAPABILITY_MATRIX.tplink_consumer.integrationStatus).toBe('GUIDE_ONLY');
    expect(ROUTER_CAPABILITY_MATRIX.zyxel_nebula.integrationStatus).toBe('OFFICIAL_API');
    expect(ROUTER_CAPABILITY_MATRIX.zyxel_consumer.integrationStatus).toBe('GUIDE_ONLY');
  });
});
