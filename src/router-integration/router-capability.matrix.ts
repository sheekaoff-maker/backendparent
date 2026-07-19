/**
 * Router Integration Engine capability database.
 *
 * Every row is backed by that vendor's OWN official developer documentation
 * (see `officialDocUrl`) — nothing here is reverse-engineered or guessed.
 * `pluginImplemented` distinguishes "this vendor publishes an official API"
 * (true for all rows with `integrationStatus: OFFICIAL_API`) from "GuardTime
 * has actually shipped working code against it" (true only for fritzbox /
 * mikrotik / openwrt this pass — the other 7 documented vendors are real,
 * confirmed integration targets for fast-follow work, not vaporware).
 *
 * TP-Link and Zyxel each contribute TWO rows because their official-API
 * coverage is partial: TP-Link's Omada SDN-managed line has a real API but
 * its consumer Deco/Archer line does not; Zyxel's Nebula cloud-managed line
 * has a real API but its consumer line does not. Detection resolves to the
 * more specific row when it can tell the product line apart, and falls back
 * to the consumer (Guide Only) row otherwise. Every other vendor is exactly
 * one row. This file therefore has 29 rows covering the 27 distinct vendor
 * names from the original spec.
 */

export type RouterIntegrationStatus = 'OFFICIAL_API' | 'GUIDE_ONLY';

export interface RouterCapabilities {
  pluginId: string;
  vendorDisplayName: string;
  integrationStatus: RouterIntegrationStatus;
  /** True only once GuardTime has shipped a working gateway-agent plugin for this pluginId. */
  pluginImplemented: boolean;
  protocol: string | null;
  officialDocUrl: string | null;
  scopeNote: string | null;
  supportsDNSChange: boolean;
  supportsFirewallRules: boolean;
  supportsPauseDevice: boolean;
  supportsClientDisconnect: boolean;
  supportsQoS: boolean;
  supportsParentalControl: boolean;
  supportsACL: boolean;
  supportsMACFiltering: boolean;
  supportsAPI: boolean;
  supportsSSH: boolean;
  supportsTR064: boolean;
  supportsRouterOS: boolean;
  supportedAuthentication: string[];
}

function guideOnly(pluginId: string, vendorDisplayName: string, scopeNote: string | null = null): RouterCapabilities {
  return {
    pluginId,
    vendorDisplayName,
    integrationStatus: 'GUIDE_ONLY',
    pluginImplemented: false,
    protocol: null,
    officialDocUrl: null,
    scopeNote,
    supportsDNSChange: false,
    supportsFirewallRules: false,
    supportsPauseDevice: false,
    supportsClientDisconnect: false,
    supportsQoS: false,
    supportsParentalControl: false,
    supportsACL: false,
    supportsMACFiltering: false,
    supportsAPI: false,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: [],
  };
}

export const ROUTER_CAPABILITY_MATRIX: Record<string, RouterCapabilities> = {
  // ================= OFFICIALLY DOCUMENTED (10) =================
  fritzbox: {
    pluginId: 'fritzbox',
    vendorDisplayName: 'AVM FRITZ!Box',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'TR-064',
    officialDocUrl: 'https://fritz.com/en/pages/interfaces',
    scopeNote: null,
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: false,
    supportsParentalControl: true,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: true,
    supportsRouterOS: false,
    supportedAuthentication: ['tr064-digest-auth'],
  },
  mikrotik: {
    pluginId: 'mikrotik',
    vendorDisplayName: 'MikroTik',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'RouterOS-REST',
    officialDocUrl: 'https://help.mikrotik.com/docs/spaces/ROS/pages/47579162/REST+API',
    scopeNote: null,
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsParentalControl: false,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: true,
    supportsTR064: false,
    supportsRouterOS: true,
    supportedAuthentication: ['http-basic-auth'],
  },
  openwrt: {
    pluginId: 'openwrt',
    vendorDisplayName: 'OpenWrt',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'ubus-JSONRPC',
    officialDocUrl: 'https://github.com/openwrt/rpcd',
    scopeNote: null,
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsParentalControl: false,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: true,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['ubus-session-login', 'ssh-key', 'ssh-password'],
  },
  unifi: {
    pluginId: 'unifi',
    vendorDisplayName: 'Ubiquiti UniFi',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: false,
    protocol: 'UniFi-Network-API',
    officialDocUrl: 'https://help.ui.com/hc/en-us/articles/30076656117655-Getting-Started-with-the-Official-UniFi-API',
    scopeNote: 'Requires a UniFi Network Application (self-hosted controller or UniFi OS console). Fast-follow plugin — not yet implemented.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsParentalControl: false,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['api-key', 'oauth'],
  },
  edgerouter: {
    pluginId: 'edgerouter',
    vendorDisplayName: 'Ubiquiti EdgeRouter',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: false,
    protocol: 'EdgeOS-SSH-CLI',
    officialDocUrl: 'https://help.ui.com',
    scopeNote: 'EdgeOS management is officially documented via SSH CLI (Vyatta-derived config commands). The EdgeOS HTTP API is NOT officially published, so this integration is CLI-only. Fast-follow plugin — not yet implemented.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: true,
    supportsParentalControl: false,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: false,
    supportsSSH: true,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['ssh-key', 'ssh-password'],
  },
  glinet: {
    pluginId: 'glinet',
    vendorDisplayName: 'GL.iNet',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: false,
    protocol: 'GLiNet-JSONRPC',
    officialDocUrl: 'https://dev.gl-inet.com/router-4.x-api/',
    scopeNote: 'Fast-follow plugin — not yet implemented.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsParentalControl: true,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: true,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['json-rpc-session-id'],
  },
  tplink_omada: {
    pluginId: 'tplink_omada',
    vendorDisplayName: 'TP-Link (Omada)',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: false,
    protocol: 'Omada-OpenAPI',
    officialDocUrl: 'https://use1-omada-northbound.tplinkcloud.com/doc.html',
    scopeNote: 'Omada SDN Controller-managed access points/routers ONLY. TP-Link\'s consumer Deco and Archer lines have no official API — see the tplink_consumer entry. Fast-follow plugin — not yet implemented.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsParentalControl: false,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['oauth2', 'api-key'],
  },
  zyxel_nebula: {
    pluginId: 'zyxel_nebula',
    vendorDisplayName: 'Zyxel (Nebula)',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: false,
    protocol: 'Nebula-OpenAPI',
    officialDocUrl: 'https://zyxelnetworks.github.io/NebulaOpenAPI/',
    scopeNote: 'Nebula cloud-managed devices ONLY. Standalone consumer Zyxel routers have no official API — see the zyxel_consumer entry. Fast-follow plugin — not yet implemented.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsParentalControl: false,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['api-key'],
  },
  draytek: {
    pluginId: 'draytek',
    vendorDisplayName: 'DrayTek',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: false,
    protocol: 'SNMP+SSH-CLI',
    officialDocUrl: 'https://www.draytek.com/support/knowledge-base/5517',
    scopeNote: 'No REST/JSON API — SNMP (DrayTek-MIB) for reads, SSH CLI for changes, both officially documented in Vigor router manuals. Fast-follow plugin — not yet implemented.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: true,
    supportsParentalControl: true,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: false,
    supportsSSH: true,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['ssh-password', 'snmp-community'],
  },
  linksys: {
    pluginId: 'linksys',
    vendorDisplayName: 'Linksys',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: false,
    protocol: 'JNAP',
    officialDocUrl:
      'https://s3-us-west-1.amazonaws.com/linksyssmartwifi.uploads/ldc/Developer+SDK+Documentation/Linksys+Smart+WiFi+Developer+SDK+API+Documentation.pdf',
    scopeNote: 'Requires registering as an approved developer in the Linksys Developer Community for production JNAP credentials. Fast-follow plugin — not yet implemented.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: true,
    supportsParentalControl: true,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['jnap-post-json'],
  },

  // ================= GUIDE ONLY (19 rows / 17 vendor names) =================
  // No public official API found in any vendor's own developer documentation.
  // Community libraries exist for several of these (e.g. AsusRouter, pynetgear,
  // eero-api) but they all reverse-engineer the mobile app or admin UI — which
  // this project does not do. Detected + shown manual setup instructions only.
  asus: guideOnly('asus', 'ASUS'),
  tplink_consumer: guideOnly('tplink_consumer', 'TP-Link', 'Deco and Archer consumer lines — see tplink_omada for Omada-managed devices.'),
  netgear: guideOnly('netgear', 'Netgear'),
  dlink: guideOnly('dlink', 'D-Link'),
  belkin: guideOnly('belkin', 'Belkin'),
  synology: guideOnly('synology', 'Synology Router'),
  google_nest_wifi: guideOnly('google_nest_wifi', 'Google Nest Wifi'),
  eero: guideOnly('eero', 'eero'),
  huawei: guideOnly('huawei', 'Huawei'),
  zyxel_consumer: guideOnly('zyxel_consumer', 'Zyxel', 'Consumer line — see zyxel_nebula for Nebula-managed devices.'),
  cisco_small_business: guideOnly('cisco_small_business', 'Cisco Small Business'),
  buffalo: guideOnly('buffalo', 'Buffalo'),
  mercusys: guideOnly('mercusys', 'Mercusys'),
  tenda: guideOnly('tenda', 'Tenda'),
  xiaomi: guideOnly('xiaomi', 'Xiaomi'),
  sagemcom: guideOnly('sagemcom', 'Sagemcom', 'Common ISP white-label device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.'),
  technicolor: guideOnly('technicolor', 'Technicolor', 'Common ISP white-label device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.'),
  arris: guideOnly('arris', 'Arris', 'Common ISP white-label device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.'),
  arcadyan: guideOnly('arcadyan', 'Arcadyan', 'Common ISP white-label ODM device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.'),
};

export function getCapabilities(pluginId: string): RouterCapabilities | null {
  return ROUTER_CAPABILITY_MATRIX[pluginId] || null;
}

export function listVendors(): RouterCapabilities[] {
  return Object.values(ROUTER_CAPABILITY_MATRIX);
}
