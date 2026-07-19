import { RouterDatabaseService } from '../src/router-integration/router-database.service';

describe('RouterDatabaseService', () => {
  const service = new RouterDatabaseService();

  it('lists all 29 vendor rows', () => {
    expect(service.listVendors()).toHaveLength(29);
  });

  it('returns capabilities for a known pluginId', () => {
    expect(service.getCapabilities('fritzbox')?.vendorDisplayName).toBe('AVM FRITZ!Box');
  });

  it('returns null for an unknown pluginId', () => {
    expect(service.getCapabilities('not-a-real-plugin')).toBeNull();
  });

  describe('resolveVendorNameToPluginId', () => {
    it.each([
      ['AVM FRITZ!Box 7590', 'fritzbox'],
      ['MikroTik RouterOS', 'mikrotik'],
      ['OpenWrt 23.05', 'openwrt'],
      ['Ubiquiti UniFi Dream Machine', 'unifi'],
      ['Ubiquiti EdgeRouter X', 'edgerouter'],
      ['GL.iNet GL-MT6000', 'glinet'],
      ['DrayTek Vigor2865', 'draytek'],
      ['Linksys Velop', 'linksys'],
      ['ASUS RT-AX88U', 'asus'],
      ['NETGEAR Nighthawk', 'netgear'],
      ['D-Link DIR-882', 'dlink'],
      ['Belkin N600', 'belkin'],
      ['Synology RT6600ax', 'synology'],
      ['Google Nest Wifi Pro', 'google_nest_wifi'],
      ['eero 6+', 'eero'],
      ['Huawei AX3', 'huawei'],
      ['Cisco RV340', 'cisco_small_business'],
      ['Buffalo AirStation', 'buffalo'],
      ['Mercusys MR70X', 'mercusys'],
      ['Tenda AC10', 'tenda'],
      ['Xiaomi Mi Router AX6000', 'xiaomi'],
      ['Sagemcom Fast 5364', 'sagemcom'],
      ['Technicolor TG799', 'technicolor'],
      ['Arris SBG10', 'arris'],
      ['Arcadyan VRV9510', 'arcadyan'],
    ])('resolves "%s" -> %s', (raw, expected) => {
      expect(service.resolveVendorNameToPluginId(raw)).toBe(expected);
    });

    it('resolves the more specific Omada hint over the generic TP-Link fallback', () => {
      expect(service.resolveVendorNameToPluginId('TP-Link Omada EAP225')).toBe('tplink_omada');
    });

    it('falls back to the generic TP-Link consumer row for Deco/Archer', () => {
      expect(service.resolveVendorNameToPluginId('TP-Link Deco M5')).toBe('tplink_consumer');
      expect(service.resolveVendorNameToPluginId('TP-Link Archer AX50')).toBe('tplink_consumer');
    });

    it('resolves the more specific Nebula hint over the generic Zyxel fallback', () => {
      expect(service.resolveVendorNameToPluginId('Zyxel Nebula NWA110AX')).toBe('zyxel_nebula');
    });

    it('falls back to the generic Zyxel consumer row otherwise', () => {
      expect(service.resolveVendorNameToPluginId('Zyxel Armor Z2')).toBe('zyxel_consumer');
    });

    it('returns null for an unrecognized vendor string', () => {
      expect(service.resolveVendorNameToPluginId('Totally Unknown Router Inc')).toBeNull();
    });

    it('returns null for empty/missing input rather than throwing', () => {
      expect(service.resolveVendorNameToPluginId(null)).toBeNull();
      expect(service.resolveVendorNameToPluginId(undefined)).toBeNull();
      expect(service.resolveVendorNameToPluginId('')).toBeNull();
    });
  });
});
