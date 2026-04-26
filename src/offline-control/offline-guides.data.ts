import { DeviceType } from '@prisma/client';

export interface OfflineGuide {
  deviceType: DeviceType;
  method: string;
  title: string;
  steps: string[];
  limitations: string[];
  officialUrl: string;
}

/**
 * Honest, vendor-official setup guides per device type.
 * Backend cannot kill offline games — these guides are the only real path.
 */
export const OFFLINE_GUIDES: Partial<Record<DeviceType, OfflineGuide>> = {
  XBOX: {
    deviceType: 'XBOX',
    method: 'XBOX_FAMILY_SAFETY',
    title: 'Microsoft Family Safety / Xbox Family Settings',
    steps: [
      'Install "Xbox Family Settings" or "Microsoft Family Safety" on your phone.',
      'Sign in with the parent Microsoft account.',
      'Add your child to the family at family.microsoft.com.',
      'In the app, set screen-time per device and content age limits.',
      'Enable "Ask to buy" for purchases.',
      'Optionally link the Microsoft account to our backend (OAuth) to sync limits.',
    ],
    limitations: [
      'We cannot directly stop a running offline game on the Xbox.',
      'All offline limits are enforced by Microsoft, not by us.',
    ],
    officialUrl: 'https://support.xbox.com/en-US/help/family-online-safety/online-safety/xbox-family-settings-app',
  },
  PLAYSTATION: {
    deviceType: 'PLAYSTATION',
    method: 'SONY_PARENTAL_CONTROLS',
    title: 'Sony PSN Family / PS5 Family Manager',
    steps: [
      'On the PS5/PS4 sign in as the Family Manager.',
      'Settings → Family and Parental Controls → Family Management.',
      'Pick the child account and configure Play Time Settings (daily limit, bedtime).',
      'Set age rating restrictions for games / blu-ray / web.',
      'Block PSN communication and user-generated content if needed.',
      'Set the home router DNS to our DNS server so all online PSN traffic is filtered.',
    ],
    limitations: [
      'Backend CANNOT stop an offline single-player PS game while it is running.',
      'Offline play-time limits must be enforced by Sony parental controls, not by us.',
    ],
    officialUrl: 'https://www.playstation.com/en-us/support/account/ps5-parental-controls/',
  },
  NINTENDO: {
    deviceType: 'NINTENDO',
    method: 'NINTENDO_PARENTAL_CONTROLS',
    title: 'Nintendo Switch Parental Controls (mobile app)',
    steps: [
      'Download "Nintendo Switch Parental Controls" on iOS/Android.',
      'On the Switch: System Settings → Parental Controls → Use Smartphone App. Scan the QR.',
      'In the app set daily play time, bedtime alarm, allowed days.',
      'Restrict by age rating; block free communication and the eShop.',
      'On the Switch: System Settings → Internet → set DNS to our server / your router.',
    ],
    limitations: [
      'Backend cannot stop an offline Switch cartridge game.',
      'Time-limit alarm is informational on the Switch — Nintendo enforces, not us.',
    ],
    officialUrl: 'https://www.nintendo.com/us/switch/parental-controls/',
  },
  STEAM_DECK: {
    deviceType: 'STEAM_DECK',
    method: 'STEAM_FAMILY_VIEW',
    title: 'Steam Family View + SteamOS account restrictions',
    steps: [
      'In Steam → Settings → Family → Family View → set a 4-digit PIN.',
      'Pick which library/store/community features the child can access.',
      'On SteamOS Desktop mode, create a separate user account with no admin rights.',
      'Set DNS at the router so all Steam network traffic goes through our filter.',
    ],
    limitations: [
      'Backend cannot stop an offline Steam game once launched.',
      'A determined child can still play any game the parent has not gated in Family View.',
    ],
    officialUrl: 'https://store.steampowered.com/parental/',
  },
  PC: {
    deviceType: 'PC',
    method: 'OS_PARENTAL_CONTROLS',
    title: 'Windows / macOS account-level parental controls',
    steps: [
      'Windows: create a Microsoft Family child account, log the PC in with it. family.microsoft.com to manage.',
      'macOS: System Settings → Family Sharing + Screen Time for the child Apple ID.',
      'Set the home router DNS to our DNS server so all PC network traffic is filtered.',
      'Optional: install our PC agent (not yet shipped) for offline app-block.',
    ],
    limitations: [
      'Without a PC agent the backend cannot kill running offline games on the PC.',
      'Offline games are controlled by the OS account, not by us.',
    ],
    officialUrl: 'https://support.microsoft.com/en-us/account-billing/microsoft-family-safety',
  },
  SMART_TV: {
    deviceType: 'SMART_TV',
    method: 'TV_PIN_PROFILE',
    title: 'Smart-TV PIN / kids-profile + DNS',
    steps: [
      'In TV settings enable a PIN for changing apps / inputs / installing apps.',
      'Create a child profile if your TV brand supports it (Samsung Kids, LG Kids, Google Kids Space).',
      'Set the TV DNS to our DNS server (Settings → Network → IP Settings → DNS Setting → Manual).',
      'Best result: set DNS at the router so the TV cannot bypass it.',
    ],
    limitations: [
      'Backend cannot stop a movie already running on a USB stick or HDMI input.',
      'No agent runs inside Smart TVs — DNS is the only enforcement.',
    ],
    officialUrl: 'https://www.samsung.com/us/support/answer/ANS00076727/',
  },
};

export function getOfflineGuide(deviceType: DeviceType): OfflineGuide | null {
  return OFFLINE_GUIDES[deviceType] ?? null;
}
