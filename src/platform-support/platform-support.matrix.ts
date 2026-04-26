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
    notes: 'Full control via child agent app with Device Admin privileges. Can block apps, lock device, enforce bedtime.',
  },
  ANDROID_TABLET: {
    deviceType: 'ANDROID_TABLET',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'ANDROID_AGENT',
    recommendedControlMethod: 'ANDROID_AGENT',
    notes: 'Same as Android Phone — full control via agent app.',
  },
  IPHONE: {
    deviceType: 'IPHONE',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'IOS_SCREEN_TIME',
    recommendedControlMethod: 'IOS_SCREEN_TIME',
    notes: 'Requires Apple Family Controls + ManagedSettings entitlement. Limited to what Apple allows.',
  },
  IPAD: {
    deviceType: 'IPAD',
    onlineControl: true,
    offlineControlSupported: true,
    offlineControlMethod: 'IOS_SCREEN_TIME',
    recommendedControlMethod: 'IOS_SCREEN_TIME',
    notes: 'Same as iPhone — requires Apple entitlement.',
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
    notes: 'Backend can block ALL ONLINE PSN traffic via DNS. Offline single-player games cannot be stopped by us — parent must use official Sony parental controls (PSN Family / PS5 Family Manager).',
  },
  NINTENDO: {
    deviceType: 'NINTENDO',
    onlineControl: true,
    offlineControlSupported: false,
    offlineControlMethod: 'NOT_SUPPORTED',
    recommendedControlMethod: 'DNS_FILTERING + OFFICIAL_PARENTAL_GUIDE',
    notes: 'Online play / eShop / cloud saves blocked via DNS. Offline games on Switch require Nintendo Switch Parental Controls app — backend cannot stop them.',
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
    recommendedControlMethod: 'DNS_FILTERING',
    notes: 'Online services (Steam, Epic, Battle.net, Discord) blocked via DNS. For full PC control, install a Windows/macOS parental agent (not provided here).',
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
