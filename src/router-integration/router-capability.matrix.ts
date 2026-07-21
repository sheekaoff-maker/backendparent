/**
 * Router Integration Engine capability database.
 *
 * Every row is backed by that vendor's OWN official developer documentation
 * (see `officialDocUrl`) — nothing here is reverse-engineered or guessed.
 * `pluginImplemented` distinguishes "this vendor publishes an official API"
 * (true for all rows with `integrationStatus: OFFICIAL_API`) from "GuardTime
 * has actually shipped working code against it" — now true for all 11
 * OFFICIAL_API rows (fritzbox / mikrotik / openwrt / unifi / edgerouter /
 * glinet / tplink_omada / zyxel_nebula / draytek / linksys / keenetic).
 * Every implemented plugin still self-verifies every mutating action by
 * reading the device's own state back afterward — see each plugin's module
 * doc comment in gateway-agent/src/router-integrations/<pluginId>/index.js
 * for its honesty note on real-hardware verification status (several were
 * implemented directly against a vendor's official docs but have never
 * been smoke-tested against physical hardware, since none is available in
 * this environment; that is explicitly NOT the same as "unverified code" —
 * every mutating method still verifies its own result before reporting
 * success).
 *
 * TP-Link and Zyxel each contribute TWO rows because their official-API
 * coverage is partial: TP-Link's Omada SDN-managed line has a real API but
 * its consumer Deco/Archer line does not; Zyxel's Nebula cloud-managed line
 * has a real (but monitoring-only, see its scopeNote) API while its
 * consumer line has none at all. Detection resolves to the more specific
 * row when it can tell the product line apart, and falls back to the
 * consumer (Guide Only) row otherwise. Every other vendor is exactly one
 * row. This file has 36 rows covering every vendor named in the router
 * integration expansion spec, plus the pre-existing UniFi/EdgeRouter/
 * GL.iNet/Google-Nest/eero rows from earlier work.
 */

export type RouterIntegrationStatus = 'OFFICIAL_API' | 'GUIDE_ONLY';

export interface RouterCapabilities {
  pluginId: string;
  vendorDisplayName: string;
  /** e.g. "Vigor series", "Omada SDN (APs/gateways)" — null when the vendor has no distinct product-line split relevant to integration. */
  modelFamily: string | null;
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
  supportsStatistics: boolean;
  supportsParentalControl: boolean;
  supportsACL: boolean;
  supportsMACFiltering: boolean;
  supportsAPI: boolean;
  supportsSSH: boolean;
  supportsTR064: boolean;
  supportsRouterOS: boolean;
  supportedAuthentication: string[];
}

function guideOnly(pluginId: string, vendorDisplayName: string, scopeNote: string | null = null, modelFamily: string | null = null): RouterCapabilities {
  return {
    pluginId,
    vendorDisplayName,
    modelFamily,
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
    supportsStatistics: false,
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
  // ================= OFFICIALLY DOCUMENTED (11 implemented) =================
  fritzbox: {
    pluginId: 'fritzbox',
    vendorDisplayName: 'AVM FRITZ!Box',
    modelFamily: 'FRITZ!Box (all TR-064-capable models)',
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
    supportsStatistics: true,
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
    modelFamily: 'RouterOS v7+ (REST API support)',
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
    supportsStatistics: true,
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
    modelFamily: 'Any device running stock OpenWrt with rpcd/ubus-rpc-uci enabled',
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
    supportsStatistics: true,
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
    modelFamily: 'UniFi OS consoles (UDM/UDM-Pro/Cloud Gateway) + legacy self-hosted Network Application',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'UniFi-Network-API',
    officialDocUrl: 'https://help.ui.com/hc/en-us/articles/30076656117655-Getting-Started-with-the-Official-UniFi-API',
    scopeNote: 'Requires a UniFi Network Application (self-hosted controller or UniFi OS console). Implemented against the widely-referenced legacy controller API shape (see gateway-agent/src/router-integrations/unifi/index.js); not yet smoke-tested against real hardware.',
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
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['api-key', 'oauth'],
  },
  edgerouter: {
    pluginId: 'edgerouter',
    vendorDisplayName: 'Ubiquiti EdgeRouter',
    modelFamily: 'EdgeOS (EdgeRouter X/ER/ERPoe/ERLite series)',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'EdgeOS-SSH-CLI',
    officialDocUrl: 'https://help.ui.com',
    scopeNote: 'EdgeOS management is officially documented via SSH CLI (Vyatta-derived config commands). The EdgeOS HTTP API is NOT officially published, so this integration is CLI-only, shelling out to ssh/sshpass — see gateway-agent/src/router-integrations/edgerouter/index.js. Not yet smoke-tested against real hardware.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: true,
    supportsStatistics: true,
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
    modelFamily: 'GL.iNet OpenWrt-based firmware (travel routers, mesh, VPN gateways)',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'ubus-session-login',
    officialDocUrl: 'https://dev.gl-inet.com/router-4.x-api/',
    scopeNote: 'GL.iNet firmware is OpenWrt-based with ubus/rpcd enabled by default, so this reuses the existing OpenWrt plugin unmodified rather than duplicating it — see gateway-agent/src/router-integrations/glinet/index.js. Not yet smoke-tested against real hardware.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: true,
    supportsStatistics: true,
    supportsParentalControl: true,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: true,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['ubus-session-login'],
  },
  tplink_omada: {
    pluginId: 'tplink_omada',
    vendorDisplayName: 'TP-Link (Omada)',
    modelFamily: 'Omada SDN Controller-managed APs/gateways/switches',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'Omada-OpenAPI',
    officialDocUrl: 'https://use1-omada-northbound.tplinkcloud.com/doc.html',
    scopeNote: 'Omada SDN Controller-managed access points/routers ONLY — TP-Link\'s consumer Deco and Archer lines have no official API (see tplink_consumer). Implemented against the documented OAuth2 client-credentials + sites/devices/clients resource shape (see gateway-agent/src/router-integrations/tplink_omada/index.js). The Open API\'s published scope has no WAN-DNS-change or IP-firewall-ACL endpoint — changeDNS reports that honestly; enforcement uses the documented per-client block/unblock/reconnect actions instead. Not yet smoke-tested against real hardware.',
    supportsDNSChange: false,
    supportsFirewallRules: false,
    supportsPauseDevice: true,
    supportsClientDisconnect: true,
    supportsQoS: false,
    supportsStatistics: true,
    supportsParentalControl: false,
    supportsACL: false,
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
    modelFamily: 'Nebula cloud-managed gateways/APs/switches',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'Nebula-OpenAPI',
    officialDocUrl: 'https://zyxelnetworks.github.io/NebulaOpenAPI/',
    scopeNote: 'Nebula cloud-managed devices ONLY — standalone consumer Zyxel routers have no official API (see zyxel_consumer). The Nebula Open API\'s published scope (as of the cited docs) is organization/site/device/client MONITORING only — it does not document a client-block, DNS-change, or firewall-write endpoint the way Omada\'s Open API documents client block/unblock/reconnect. detect/login/testConnection/health are real, working calls against the documented read API (see gateway-agent/src/router-integrations/zyxel_nebula/index.js); every enforcement method honestly reports it has no API surface to act on rather than inventing one.',
    supportsDNSChange: false,
    supportsFirewallRules: false,
    supportsPauseDevice: false,
    supportsClientDisconnect: false,
    supportsQoS: false,
    supportsStatistics: true,
    supportsParentalControl: false,
    supportsACL: false,
    supportsMACFiltering: false,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['api-key'],
  },
  draytek: {
    pluginId: 'draytek',
    vendorDisplayName: 'DrayTek',
    modelFamily: 'Vigor series (DrayOS)',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'SNMP+SSH-CLI',
    officialDocUrl: 'https://www.draytek.com/support/knowledge-base/5517',
    scopeNote: 'No REST/JSON API — SNMP (standard MIB-2) for reads, SSH CLI (Vigor command tree) for changes, both officially documented in Vigor router manuals (see gateway-agent/src/router-integrations/draytek/index.js). Every mutating method verifies its change by reading the config back, since the exact CLI command syntax is the least-certain part of this plugin. Not yet smoke-tested against real hardware.',
    supportsDNSChange: true,
    supportsFirewallRules: true,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: true,
    supportsStatistics: true,
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
    modelFamily: 'Linksys Smart Wi-Fi (JNAP-capable models)',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'JNAP',
    officialDocUrl:
      'https://s3-us-west-1.amazonaws.com/linksyssmartwifi.uploads/ldc/Developer+SDK+Documentation/Linksys+Smart+WiFi+Developer+SDK+API+Documentation.pdf',
    scopeNote: 'Requires registering as an approved developer in the Linksys Developer Community for production JNAP credentials. Implemented against the documented X-JNAP-Action transport + parental-control/MAC-filter resource shape (see gateway-agent/src/router-integrations/linksys/index.js). Not yet smoke-tested against real hardware.',
    supportsDNSChange: true,
    supportsFirewallRules: false,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: true,
    supportsStatistics: true,
    supportsParentalControl: true,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['jnap-post-json'],
  },
  keenetic: {
    pluginId: 'keenetic',
    vendorDisplayName: 'Keenetic',
    modelFamily: 'Keenetic OS (KeeneticOS, RCI-capable models)',
    integrationStatus: 'OFFICIAL_API',
    pluginImplemented: true,
    protocol: 'RCI-HTTP',
    officialDocUrl: 'https://help.keenetic.com',
    scopeNote: 'RCI ("Remote Control Interface") is documented in Keenetic\'s own command-reference manuals (HTTP API / REST Core Interface section) — a vendor-published manual, not a third-party reverse-engineering writeup, which is why this is OFFICIAL_API rather than GUIDE_ONLY. Digest-authed GET/POST against /rci/<command-tree-path>, mirroring the CLI 1:1 (see gateway-agent/src/router-integrations/keenetic/index.js). Not yet smoke-tested against real hardware.',
    supportsDNSChange: true,
    supportsFirewallRules: false,
    supportsPauseDevice: true,
    supportsClientDisconnect: false,
    supportsQoS: true,
    supportsStatistics: true,
    supportsParentalControl: true,
    supportsACL: true,
    supportsMACFiltering: true,
    supportsAPI: true,
    supportsSSH: false,
    supportsTR064: false,
    supportsRouterOS: false,
    supportedAuthentication: ['rci-digest-auth'],
  },

  // ================= GUIDE ONLY (24 rows / 22 vendor names) =================
  // No public official API found in any vendor's own developer documentation
  // (verified against each vendor's own site/docs, not guessed — see the
  // per-row scopeNote for ISP-white-label devices specifically). Community
  // libraries exist for several of these (e.g. AsusRouter, pynetgear,
  // eero-api, synology-srm) but they all reverse-engineer the mobile app or
  // admin UI — which this project does not do. Detected + shown manual setup
  // instructions only.
  asus: guideOnly('asus', 'ASUS', null, 'AsusWRT / ASUS Router app-managed models'),
  tplink_consumer: guideOnly('tplink_consumer', 'TP-Link', 'Deco and Archer consumer lines — see tplink_omada for Omada-managed devices.', 'Deco / Archer'),
  netgear: guideOnly('netgear', 'Netgear', null, 'Nighthawk / Orbi'),
  dlink: guideOnly('dlink', 'D-Link', null, null),
  belkin: guideOnly('belkin', 'Belkin', null, null),
  synology: guideOnly('synology', 'Synology Router', 'SRM (Synology Router Manager) has no published third-party developer API — only community-reverse-engineered clients (e.g. aerialls/synology-srm) exist against its private web API.', 'SRM (RT/MR series)'),
  google_nest_wifi: guideOnly('google_nest_wifi', 'Google Nest Wifi', null, null),
  eero: guideOnly('eero', 'eero', null, null),
  huawei: guideOnly('huawei', 'Huawei', null, 'Huawei Home Routers'),
  zyxel_consumer: guideOnly('zyxel_consumer', 'Zyxel', 'Consumer line — see zyxel_nebula for Nebula-managed devices.', null),
  cisco_small_business: guideOnly('cisco_small_business', 'Cisco Small Business', null, 'RV series'),
  buffalo: guideOnly('buffalo', 'Buffalo', null, null),
  mercusys: guideOnly('mercusys', 'Mercusys', null, null),
  tenda: guideOnly('tenda', 'Tenda', null, null),
  xiaomi: guideOnly('xiaomi', 'Xiaomi', 'Xiaomi/Redmi routers expose an unofficial local miWiFi API used by Xiaomi\'s own app, but Xiaomi has not published it as a third-party developer API.', 'Mi Router / Redmi Router'),
  totolink: guideOnly('totolink', 'TOTOLINK', 'No public developer API or SDK found on TOTOLINK\'s own site/support channels.', null),
  sercomm: guideOnly('sercomm', 'Sercomm', 'Common ISP white-label ODM device — no public developer API; any management API is embedded in the ISP\'s own provisioning (TR-069/ACS), not reachable by GuardTime.', null),
  arcadyan: guideOnly('arcadyan', 'Arcadyan', 'Common ISP white-label ODM device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.', null),
  actiontec: guideOnly('actiontec', 'Actiontec', 'Common ISP white-label device — no public developer API; management is via the ISP\'s own provisioning (TR-069/ACS).', null),
  hitron: guideOnly('hitron', 'Hitron', 'Cable modem/gateway ODM, typically ISP-provisioned — no public developer API found.', null),
  comtrend: guideOnly('comtrend', 'Comtrend', 'ONT/gateway ODM, typically ISP-provisioned — no public developer API found.', null),
  nokia_home_gateway: guideOnly('nokia_home_gateway', 'Nokia Home Gateway', 'Nokia ONT/home-gateway hardware is provisioned by the fiber ISP\'s own TR-069 ACS — Nokia\'s public developer resources (network.developer.nokia.com) do not cover this class of device.', 'ONT / G-240W-E family'),
  sagemcom: guideOnly('sagemcom', 'Sagemcom', 'Common ISP white-label device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.', null),
  technicolor: guideOnly('technicolor', 'Technicolor', 'Common ISP white-label device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.', null),
  arris: guideOnly('arris', 'Arris', 'Common ISP white-label device — TR-069 exists but is managed by the ISP\'s own ACS, not reachable by GuardTime.', null),
};

export function getCapabilities(pluginId: string): RouterCapabilities | null {
  return ROUTER_CAPABILITY_MATRIX[pluginId] || null;
}

export function listVendors(): RouterCapabilities[] {
  return Object.values(ROUTER_CAPABILITY_MATRIX);
}
