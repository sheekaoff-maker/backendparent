import { Injectable } from '@nestjs/common';
import { ROUTER_CAPABILITY_MATRIX, RouterCapabilities } from './router-capability.matrix';

/**
 * Ordered most-specific-first so e.g. an "Omada" hint resolves before the
 * generic "TP-Link" fallback, and "Nebula" resolves before generic "Zyxel".
 */
const VENDOR_NAME_PATTERNS: Array<{ pattern: RegExp; pluginId: string }> = [
  { pattern: /avm|fritz\s*!?\s*box|fritzbox/i, pluginId: 'fritzbox' },
  { pattern: /mikrotik|routeros/i, pluginId: 'mikrotik' },
  { pattern: /openwrt|lede/i, pluginId: 'openwrt' },
  { pattern: /unifi/i, pluginId: 'unifi' },
  { pattern: /edgerouter|edgemax|edgeos/i, pluginId: 'edgerouter' },
  { pattern: /gl[\s.-]?inet/i, pluginId: 'glinet' },
  { pattern: /omada/i, pluginId: 'tplink_omada' },
  { pattern: /deco|archer|tp[\s-]?link/i, pluginId: 'tplink_consumer' },
  { pattern: /nebula/i, pluginId: 'zyxel_nebula' },
  { pattern: /zyxel/i, pluginId: 'zyxel_consumer' },
  { pattern: /draytek|vigor/i, pluginId: 'draytek' },
  { pattern: /linksys/i, pluginId: 'linksys' },
  { pattern: /asus/i, pluginId: 'asus' },
  { pattern: /netgear/i, pluginId: 'netgear' },
  { pattern: /d[\s-]?link/i, pluginId: 'dlink' },
  { pattern: /belkin/i, pluginId: 'belkin' },
  { pattern: /synology/i, pluginId: 'synology' },
  { pattern: /nest\s*wifi|google\s*wifi|onhub/i, pluginId: 'google_nest_wifi' },
  { pattern: /eero/i, pluginId: 'eero' },
  { pattern: /huawei/i, pluginId: 'huawei' },
  { pattern: /cisco/i, pluginId: 'cisco_small_business' },
  { pattern: /buffalo/i, pluginId: 'buffalo' },
  { pattern: /mercusys/i, pluginId: 'mercusys' },
  { pattern: /tenda/i, pluginId: 'tenda' },
  { pattern: /xiaomi|mi\s*router|redmi/i, pluginId: 'xiaomi' },
  { pattern: /sagemcom/i, pluginId: 'sagemcom' },
  { pattern: /technicolor/i, pluginId: 'technicolor' },
  { pattern: /arris/i, pluginId: 'arris' },
  { pattern: /arcadyan/i, pluginId: 'arcadyan' },
];

@Injectable()
export class RouterDatabaseService {
  listVendors(): RouterCapabilities[] {
    return Object.values(ROUTER_CAPABILITY_MATRIX);
  }

  getCapabilities(pluginId: string): RouterCapabilities | null {
    return ROUTER_CAPABILITY_MATRIX[pluginId] || null;
  }

  /** Best-effort, pattern-based — never throws, returns null when nothing matches. */
  resolveVendorNameToPluginId(rawVendorString: string | null | undefined): string | null {
    if (!rawVendorString) return null;
    for (const { pattern, pluginId } of VENDOR_NAME_PATTERNS) {
      if (pattern.test(rawVendorString)) return pluginId;
    }
    return null;
  }
}
