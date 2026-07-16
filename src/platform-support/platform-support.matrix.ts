import { DeviceType } from '@prisma/client';

export interface PlatformSupport {
  deviceType: DeviceType;
  onlineControl: boolean;
  offlineControlSupported: boolean;
  offlineControlMethod:
    | 'ANDROID_AGENT'
    | 'IOS_SCREEN_TIME'
    | 'XBOX_ACCOUNT'
    | 'NOT_SUPPORTED';
  recommendedControlMethod: string;
  notes: string;
}

/**
 * Honest, reality-based mapping of what we can and cannot control.
 * Read this before promising features to parents.
 */
export const PLATFORM_SUPPORT_MATRIX: Record<DeviceType, PlatformSupport> = {
  ANDROID_PHONE: {
    deviceType: 'ANDROID_PHONE',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'ANDROID_AGENT',
    recommendedControlMethod: 'ANDROID_AGENT',
    notes: 'Child agent (Device Admin) is the reliable control — blocks apps, locks device, enforces bedtime, and works on cellular. Device DNS is weak: Android Private DNS is device-wide and child-changeable, and some apps use their own DoH.',
  },
  ANDROID_TABLET: {
    deviceType: 'ANDROID_TABLET',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'ANDROID_AGENT',
    recommendedControlMethod: 'ANDROID_AGENT',
    notes: 'Same as Android Phone — agent is primary; Private DNS / app DoH can bypass device-level DNS.',
  },
  IPHONE: {
    deviceType: 'IPHONE',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'IOS_SCREEN_TIME',
    recommendedControlMethod: 'IOS_SCREEN_TIME',
    notes: 'Screen Time (Family Sharing) is the real control. DNS filtering only applies if a DNS profile is installed AND iCloud Private Relay is off; per-Wi-Fi DNS never covers cellular. App-level DoH can still bypass DNS.',
  },
  IPAD: {
    deviceType: 'IPAD',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'IOS_SCREEN_TIME',
    recommendedControlMethod: 'IOS_SCREEN_TIME',
    notes: 'Same as iPhone — Screen Time is primary; iCloud Private Relay and app DoH bypass device DNS.',
  },
  XBOX: {
    deviceType: 'XBOX',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'XBOX_ACCOUNT',
    recommendedControlMethod: 'XBOX_ACCOUNT',
    notes: 'Use Microsoft Family / Xbox Family Settings via OAuth. Online + offline limits enforced by Microsoft. Falls back to DNS_FILTERING for online block.',
  },
  PLAYSTATION: {
    deviceType: 'PLAYSTATION',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + OFFICIAL_PARENTAL_GUIDE',
    notes: 'Blocks online PSN traffic via DNS (PS5/PS5 Slim/PS4; Portal streams from a PS5). Set console IPv6 to Off so it does not bypass IPv4 DNS. Offline single-player games cannot be stopped — use Sony Family / PS5 Family Manager.',
  },
  NINTENDO: {
    deviceType: 'NINTENDO',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + OFFICIAL_PARENTAL_GUIDE',
    notes: 'Online play / eShop / cloud saves blocked via DNS (Switch 2, Switch, OLED, Lite — same flow). Offline games and Switch 2 GameChat need the Nintendo Switch Parental Controls app — backend cannot stop them.',
  },
  STEAM_DECK: {
    deviceType: 'STEAM_DECK',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + OFFICIAL_PARENTAL_GUIDE',
    notes: 'Steam online + downloads blocked via DNS. Offline Steam games cannot be killed by backend — use Steam Family View on the device.',
  },
  PC: {
    deviceType: 'PC',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + OFFICIAL_PARENTAL_GUIDE',
    notes: 'Windows: DNS filtering works only if the child uses a Standard (non-admin) account and browser DoH is disabled. Pair with Microsoft Family Safety for app/time limits. IPv6 and browser DoH+ECH can bypass DNS.',
  },
  MAC: {
    deviceType: 'MAC',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + OFFICIAL_PARENTAL_GUIDE',
    notes: 'macOS: Screen Time (Family Sharing) is the stronger control. Device DNS filters only with iCloud Private Relay off and the child on a Standard account; browser DoH still bypasses it.',
  },
  SMART_TV: {
    deviceType: 'SMART_TV',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + ROUTER_GATEWAY',
    notes: 'Streaming + smart-TV apps blocked via DNS. No agent available — for hard control use the router/gateway to disable internet.',
  },
  STREAMING_BOX: {
    deviceType: 'STREAMING_BOX',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + ROUTER_GATEWAY',
    notes: 'Same as Smart TV — DNS blocking for streaming services + router gateway as fallback.',
  },
  OTHER: {
    deviceType: 'OTHER',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING',
    notes: 'Generic device — DNS-only filtering is supported. No offline guarantees.',
  },
};

export function getPlatformSupport(deviceType: DeviceType): PlatformSupport {
  return PLATFORM_SUPPORT_MATRIX[deviceType] || PLATFORM_SUPPORT_MATRIX.OTHER;
}
