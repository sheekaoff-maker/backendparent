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
 * Vendor-official on-device / offline parental-control guides, verified against
 * current (2025–2026) platform behaviour.
 *
 * DNS filtering cannot stop an offline game or enforce play-time on its own —
 * these are the manufacturer tools that actually do. Keep this honest: state
 * plainly where the backend has no power and the vendor control is the only
 * real option.
 */
export const OFFLINE_GUIDES: Partial<Record<DeviceType, OfflineGuide>> = {
  XBOX: {
    deviceType: 'XBOX',
    method: 'MICROSOFT_FAMILY_SAFETY',
    title: 'Microsoft Family Safety / Xbox Family Settings',
    steps: [
      'Install "Microsoft Family Safety" (or "Xbox Family Settings") on your phone.',
      'Sign in with the parent Microsoft account and add the child at family.microsoft.com.',
      'Have the child sign in on the Xbox at least once so it appears in the family.',
      'In the app set screen-time per device, content/age limits and "Ask to buy".',
      'Optionally link the Microsoft account to GuardTime (OAuth) to sync limits.',
    ],
    limitations: [
      'GuardTime cannot directly stop a running offline game on the Xbox.',
      'Offline screen-time and content limits are enforced by Microsoft, not by us.',
    ],
    officialUrl: 'https://support.xbox.com/en-US/help/family-online-safety/online-safety/xbox-family-settings-app',
  },
  PLAYSTATION: {
    deviceType: 'PLAYSTATION',
    method: 'SONY_FAMILY_MANAGEMENT',
    title: 'PlayStation Family / PS5 Family Manager',
    steps: [
      'On the PS5/PS4 sign in as the Family Manager (or manage from the PlayStation App).',
      'Settings → Family and Parental Controls → Family Management → pick the child.',
      'Set Play Time Settings: daily limit, bedtime, and allowed days.',
      'Set age-level restrictions for games, Blu-ray and the web browser.',
      'Restrict PSN communication and user-generated content if needed.',
    ],
    limitations: [
      'The backend cannot stop an offline single-player PlayStation game while it runs.',
      'Offline play-time limits are enforced by Sony, not by us.',
    ],
    officialUrl: 'https://www.playstation.com/en-us/support/account/ps5-parental-controls/',
  },
  NINTENDO: {
    deviceType: 'NINTENDO',
    method: 'NINTENDO_PARENTAL_CONTROLS',
    title: 'Nintendo Switch Parental Controls (mobile app)',
    steps: [
      'Install "Nintendo Switch Parental Controls" on iOS/Android and sign in.',
      'On the console: System Settings → Parental Controls → Parental Controls Settings → link via the app (register the code / scan).',
      'Set a 4–8 digit PIN, daily play-time limit, bedtime and allowed play window.',
      'Restrict by age rating; block or limit eShop, free communication and social posting.',
      'On Switch 2, manage GameChat: choose which friends the child can chat with and review history.',
    ],
    limitations: [
      'The backend cannot stop an offline Switch cartridge/downloaded game.',
      'Parental controls are system-wide (per console), not per user — Nintendo enforces them, not us.',
    ],
    officialUrl: 'https://en-americas-support.nintendo.com/app/answers/detail/a_id/22447',
  },
  STEAM_DECK: {
    deviceType: 'STEAM_DECK',
    method: 'STEAM_FAMILY_VIEW',
    title: 'Steam Family View + SteamOS account',
    steps: [
      'Steam → Settings → Family → Family View → set a PIN.',
      'Choose which library, store and community features the child may access.',
      'In Desktop mode, keep the child on a non-admin user account.',
      'Set DNS at the router so Steam network traffic is filtered.',
    ],
    limitations: [
      'The backend cannot stop an offline Steam game once installed.',
      'A child can still launch any game not gated in Family View.',
    ],
    officialUrl: 'https://store.steampowered.com/parental/',
  },
  PC: {
    deviceType: 'PC',
    method: 'MICROSOFT_FAMILY_SAFETY',
    title: 'Windows — Microsoft Family Safety',
    steps: [
      'Create a Microsoft child account and sign the PC in with it (child = Standard user).',
      'Manage at family.microsoft.com or in the Microsoft Family Safety app.',
      'Set screen-time, app/game age limits and web filtering (Microsoft Edge).',
      'Set the home router DNS to GuardTime so PC network traffic is filtered.',
    ],
    limitations: [
      'Without a PC agent the backend cannot stop a running offline game.',
      'A child with a local admin account, or using a browser with its own DoH, can bypass limits.',
    ],
    officialUrl: 'https://support.microsoft.com/en-us/account-billing/microsoft-family-safety',
  },
  MAC: {
    deviceType: 'MAC',
    method: 'APPLE_SCREEN_TIME',
    title: 'macOS — Screen Time (Family Sharing)',
    steps: [
      'Add the child to Family Sharing (System Settings → Family).',
      'System Settings → Screen Time → select the child → set Downtime, App Limits and Content & Privacy Restrictions.',
      'Turn off iCloud Private Relay so device DNS filtering can apply to Safari.',
      'Keep the child on a Standard (non-admin) macOS account.',
    ],
    limitations: [
      'The backend cannot stop a running offline app; Screen Time enforces limits.',
      'An admin account can undo Screen Time and DNS changes.',
    ],
    officialUrl: 'https://support.apple.com/en-us/HT208982',
  },
  IPHONE: {
    deviceType: 'IPHONE',
    method: 'APPLE_SCREEN_TIME',
    title: 'iPhone — Screen Time (Family Sharing)',
    steps: [
      'Add the child to Family Sharing (Settings → your name → Family).',
      'Settings → Screen Time → set up for the child → Downtime, App Limits, Communication Limits.',
      'Content & Privacy Restrictions → limit apps, purchases, web content and network changes.',
      'Turn off iCloud Private Relay (Settings → Apple Account → iCloud → Private Relay) for DNS filtering to apply.',
    ],
    limitations: [
      'The backend cannot force-close a running app; Screen Time enforces limits.',
      'Cellular traffic is only governed by Screen Time, not by home/router DNS.',
    ],
    officialUrl: 'https://support.apple.com/en-us/HT201304',
  },
  IPAD: {
    deviceType: 'IPAD',
    method: 'APPLE_SCREEN_TIME',
    title: 'iPad — Screen Time (Family Sharing)',
    steps: [
      'Add the child to Family Sharing (Settings → your name → Family).',
      'Settings → Screen Time → set up for the child → Downtime, App Limits, Communication Limits.',
      'Content & Privacy Restrictions → limit apps, purchases, web content and network changes.',
      'Turn off iCloud Private Relay for DNS filtering to apply to Safari.',
    ],
    limitations: [
      'The backend cannot force-close a running app; Screen Time enforces limits.',
      'Cellular iPads bypass home/router DNS — rely on Screen Time.',
    ],
    officialUrl: 'https://support.apple.com/en-us/HT201304',
  },
  ANDROID_PHONE: {
    deviceType: 'ANDROID_PHONE',
    method: 'GOOGLE_FAMILY_LINK',
    title: 'Android — Google Family Link + GuardTime agent',
    steps: [
      'Install Google Family Link (parent) and add the child account.',
      'On the child phone, sign in with the supervised account and grant Family Link.',
      'Set screen-time, app limits, bedtime and content/age restrictions in Family Link.',
      'Install the GuardTime child agent (Device Admin) for app-block and cross-network filtering.',
      'Check Settings → Network & internet → Private DNS is Off/Automatic so it does not override filtering.',
    ],
    limitations: [
      'Without the agent, DNS-only filtering does not cover mobile data.',
      'A child can change Private DNS or use an app with its own DoH unless the agent locks it down.',
    ],
    officialUrl: 'https://families.google/familylink/',
  },
  ANDROID_TABLET: {
    deviceType: 'ANDROID_TABLET',
    method: 'GOOGLE_FAMILY_LINK',
    title: 'Android tablet — Google Family Link + GuardTime agent',
    steps: [
      'Install Google Family Link (parent) and add the supervised child account.',
      'Sign the tablet in with the supervised account and grant Family Link.',
      'Set screen-time, app limits, bedtime and content restrictions in Family Link.',
      'Install the GuardTime child agent for app-block and reliable filtering.',
      'Ensure Private DNS is Off/Automatic (Settings → Network & internet → Private DNS).',
    ],
    limitations: [
      'DNS-only filtering does not cover mobile data — the agent does.',
      'Private DNS / app DoH can bypass device DNS unless locked by the agent.',
    ],
    officialUrl: 'https://families.google/familylink/',
  },
  SMART_TV: {
    deviceType: 'SMART_TV',
    method: 'TV_PIN_PROFILE',
    title: 'Smart-TV PIN / kids-profile + DNS',
    steps: [
      'In TV settings enable a PIN for changing apps, inputs and installing apps.',
      'Create a child profile if supported (Samsung Kids, LG Kids, Google Kids Space, Apple TV restrictions).',
      'Set the TV DNS to GuardTime (Settings → Network → IP Settings → DNS → Manual).',
      'Best result: set DNS at the router so the TV cannot bypass it.',
    ],
    limitations: [
      'The backend cannot stop content already playing from USB or an HDMI input.',
      'No agent runs inside a Smart TV — DNS (ideally at the router) is the only enforcement.',
    ],
    officialUrl: 'https://www.samsung.com/us/support/answer/ANS00076727/',
  },
};

export function getOfflineGuide(deviceType: DeviceType): OfflineGuide | null {
  return OFFLINE_GUIDES[deviceType] ?? null;
}
