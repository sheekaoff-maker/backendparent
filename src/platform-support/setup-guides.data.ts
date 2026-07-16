export interface GuideStep {
  step: number;
  title: string;
  description: string;
}

export interface SetupGuideData {
  platform: string;
  title: string;
  /** One-line summary of what this guide achieves and how strong it is. */
  summary?: string;
  steps: GuideStep[];
  /** Honest, platform-specific caveats that determine whether filtering holds. */
  caveats?: string[];
  videoUrl?: string;
}

/**
 * Network / DNS onboarding guides, verified against current (2025–2026)
 * official platform behaviour.
 *
 * Guiding principle: DNS filtering is a useful FIRST layer, not a tamper-proof
 * control. Every guide is explicit about what defeats it on that platform
 * (IPv6, DoH/DoT, iCloud Private Relay, Android Private DNS, per-network scope)
 * so parents are not given false confidence. Router-level DNS is recommended
 * as the strongest option because it also covers devices that cannot be
 * configured individually and survives on-device network resets.
 */
export const SETUP_GUIDES: SetupGuideData[] = [
  {
    platform: 'ROUTER',
    title: 'Home router DNS (recommended — covers every device)',
    summary:
      'Strongest DNS option: filters all devices on the home Wi-Fi/Ethernet and cannot be reset from a child\'s device.',
    steps: [
      { step: 1, title: 'Open your router admin page', description: 'In a browser go to 192.168.1.1 or 192.168.0.1 (check the sticker on the router).' },
      { step: 2, title: 'Sign in', description: 'Use the admin password on the router sticker. Change it if it is still the default.' },
      { step: 3, title: 'Find DHCP / LAN DNS settings', description: 'Look under Internet, WAN, or LAN / DHCP. Set the DNS the router hands to devices, not just the router\'s own upstream DNS.' },
      { step: 4, title: 'Set our resolver', description: 'Primary DNS: <YOUR_DNS_SERVER_IP>. Leave the secondary blank or also point it at us — a public secondary (e.g. 1.1.1.1) becomes a bypass.' },
      { step: 5, title: 'Disable or filter IPv6', description: 'If the router hands out IPv6, devices can resolve over IPv6 and skip our IPv4 DNS. Turn IPv6 off, or set an IPv6 DNS you control.' },
      { step: 6, title: 'Save and reboot', description: 'Restart the router, then reconnect a device and confirm traffic is being filtered.' },
    ],
    caveats: [
      'Only covers the home network. Mobile data and other Wi-Fi networks are not filtered.',
      'A browser or app using DNS-over-HTTPS (DoH) bypasses router DNS. Use device-level controls to disable DoH where it matters.',
    ],
  },
  {
    platform: 'XBOX',
    title: 'Xbox (Series X | Series S | One) — DNS setup',
    summary: 'Filters Xbox online traffic. Pair with Microsoft Family Safety for time and content limits.',
    steps: [
      { step: 1, title: 'Open Network settings', description: 'Press the Xbox button → Profile & system → Settings → General → Network settings.' },
      { step: 2, title: 'Advanced settings', description: 'Select Advanced settings → DNS settings.' },
      { step: 3, title: 'Switch to Manual', description: 'Choose Manual (not Automatic).' },
      { step: 4, title: 'Enter our DNS', description: 'Primary IPv4 DNS: <YOUR_DNS_SERVER_IP>. Secondary: leave blank or point at us. Press B to save.' },
      { step: 5, title: 'Test the connection', description: 'Settings → General → Network settings → Test network connection to confirm the console is online.' },
    ],
    caveats: [
      'DNS steps are identical on Series X, Series S and Xbox One — the dashboard is shared.',
      'DNS is set per connection type. Set it on both Wi-Fi and Ethernet if the console uses both.',
      'Offline/single-player games keep running with no internet — DNS cannot stop them. Use Microsoft Family Safety for screen-time limits.',
    ],
    videoUrl: 'https://support.xbox.com/en-US/help/hardware-network/connect-network/advanced-network-settings',
  },
  {
    platform: 'PLAYSTATION',
    title: 'PlayStation (PS5 | PS5 Slim | PS4) — DNS setup',
    summary: 'Filters PSN online traffic. Pair with PS Family / Family Manager for play-time limits.',
    steps: [
      { step: 1, title: 'Open Network settings', description: 'PS5: Settings → Network → Settings → Set Up Internet Connection. PS4: Settings → Network → Set Up Internet Connection.' },
      { step: 2, title: 'Choose your connection', description: 'Pick the Wi-Fi network (or LAN cable) the console uses, then choose Custom / Advanced Settings.' },
      { step: 3, title: 'Set DNS to Manual', description: 'For IP/DHCP keep Automatic; for DNS Settings choose Manual.' },
      { step: 4, title: 'Enter our DNS', description: 'Primary DNS: <YOUR_DNS_SERVER_IP>. Secondary: leave blank or point at us. Save and continue.' },
      { step: 5, title: 'Test Internet Connection', description: 'Settings → Network → Connection Status → Test Internet Connection.' },
    ],
    caveats: [
      'PS5 and PS5 Slim are identical for this flow. PlayStation Portal streams from a PS5 and follows the PS5\'s network — configure the PS5, not the Portal.',
      'Set IPv6 to Off (or Automatic without an IPv6 DNS) so the console does not bypass IPv4 DNS.',
      'Offline single-player games cannot be stopped by DNS — use Sony Family / PS5 Family Manager for play-time enforcement.',
    ],
    videoUrl: 'https://www.playstation.com/en-us/support/account/ps5-parental-controls/',
  },
  {
    platform: 'NINTENDO',
    title: 'Nintendo Switch (Switch 2 | Switch | OLED | Lite) — DNS setup',
    summary: 'Filters eShop / online play. Pair with the Nintendo Switch Parental Controls app for limits.',
    steps: [
      { step: 1, title: 'Open Internet Settings', description: 'From the HOME Menu: System Settings → Internet → Internet Settings.' },
      { step: 2, title: 'Select your network', description: 'Under Saved Networks pick the Wi-Fi the console uses, then Change Settings.' },
      { step: 3, title: 'Set DNS to Manual', description: 'Scroll to DNS Settings → Manual.' },
      { step: 4, title: 'Enter our DNS', description: 'Detailed DNS → Primary DNS: <YOUR_DNS_SERVER_IP>. Secondary: leave 0.0.0.0 or point at us. Save.' },
      { step: 5, title: 'Reconnect', description: 'Choose Connect to This Network to apply the new DNS.' },
    ],
    caveats: [
      'Flow is identical on Switch 2, Switch, OLED and Lite.',
      'DNS is stored per saved Wi-Fi network. A new network or a network reset drops it.',
      'On Switch 2, use the Nintendo Switch Parental Controls app for GameChat and play-time limits — DNS does not manage those.',
    ],
    videoUrl: 'https://en-americas-support.nintendo.com/app/answers/detail/a_id/22411',
  },
  {
    platform: 'WINDOWS',
    title: 'Windows 11 PC — DNS setup',
    summary: 'Filters standard DNS. A child with an admin account (or a browser using DoH) can bypass it — use a Standard account.',
    steps: [
      { step: 1, title: 'Open network settings', description: 'Press Windows + I → Network & internet → select Wi-Fi (or Ethernet).' },
      { step: 2, title: 'Open Hardware properties', description: 'Click the connected network → Hardware properties (or the adapter → Hardware properties).' },
      { step: 3, title: 'Edit DNS assignment', description: 'Next to "DNS server assignment" click Edit → switch the drop-down to Manual.' },
      { step: 4, title: 'Enter our DNS', description: 'Turn IPv4 On → Preferred DNS: <YOUR_DNS_SERVER_IP>. Leave Alternate blank. Turn IPv6 Off unless you also control an IPv6 DNS.' },
      { step: 5, title: 'Optional: lock encryption', description: 'If offered, set DNS-over-HTTPS to "Off" so the child cannot rely on the OS DoH; save.' },
    ],
    caveats: [
      'Make the child a Standard (non-admin) Windows account, or they can change DNS back.',
      'Chrome/Edge/Firefox can enable their own DoH (with ECH) and bypass this entirely. Enforce browser policy or use Microsoft Family Safety for app/site limits.',
      'Router-level DNS is more reliable for a PC that a child can administer.',
    ],
    videoUrl: 'https://support.microsoft.com/en-us/account-billing/microsoft-family-safety',
  },
  {
    platform: 'MACOS',
    title: 'macOS — DNS setup',
    summary: 'Filters standard DNS. Screen Time is the stronger control; Private Relay must be off for DNS to apply to Safari.',
    steps: [
      { step: 1, title: 'Open Network settings', description: 'Apple menu → System Settings → Network → select Wi-Fi (or Ethernet) → Details.' },
      { step: 2, title: 'Open the DNS tab', description: 'In the Details sheet choose DNS.' },
      { step: 3, title: 'Add our DNS', description: 'Under DNS Servers click + and add <YOUR_DNS_SERVER_IP>. Remove other entries so they are not used as fallbacks. Click OK.' },
      { step: 4, title: 'Turn off iCloud Private Relay', description: 'System Settings → Apple Account → iCloud → Private Relay → Off. While on, Safari bypasses your DNS via encrypted relay.' },
      { step: 5, title: 'Use a Standard account', description: 'Manage the child as a Standard (non-admin) user and set limits in Screen Time.' },
    ],
    caveats: [
      'An admin user can change DNS back — keep the child on a Standard account.',
      'iCloud Private Relay and browser DoH both bypass device DNS. Disable them or rely on Screen Time.',
      'Router DNS is the most tamper-resistant option for a shared Mac.',
    ],
    videoUrl: 'https://support.apple.com/guide/mac-help/mchlp1717/mac',
  },
  {
    platform: 'ANDROID',
    title: 'Android phone / tablet — DNS & filtering',
    summary:
      'On-device DNS on Android is weak and easily changed. The GuardTime child agent is the real control; use router DNS at home.',
    steps: [
      { step: 1, title: 'Install the GuardTime child agent', description: 'The agent (Device Admin) is the reliable way to enforce app blocks, bedtime and filtering on Android — not manual DNS.' },
      { step: 2, title: 'Check Private DNS', description: 'Settings → Network & internet → Private DNS. If a child set a provider hostname here, it overrides everything — set it to Off or Automatic, then lock it via the agent.' },
      { step: 3, title: 'Filter at the router', description: 'Point your home router DNS at <YOUR_DNS_SERVER_IP> so all home Wi-Fi traffic is filtered regardless of device settings.' },
      { step: 4, title: 'Optional per-Wi-Fi DNS', description: 'To force DNS without the agent: Settings → Wi-Fi → (network) → IP settings → Static, then set DNS 1 to <YOUR_DNS_SERVER_IP>. This is per-network and does not cover mobile data.' },
    ],
    caveats: [
      'Manual/router DNS only covers Wi-Fi. Mobile data is only filtered by the agent.',
      'Android "Private DNS" is device-wide DoT — a child can point it at another resolver unless the agent locks it.',
      'Some apps use their own DoH and ignore system DNS entirely.',
    ],
    videoUrl: 'https://support.google.com/families/answer/7101025',
  },
  {
    platform: 'IOS',
    title: 'iPhone / iPad — Screen Time & DNS',
    summary:
      'Screen Time is the real control on iOS. Device DNS only filters if a DNS profile is installed AND iCloud Private Relay is off.',
    steps: [
      { step: 1, title: 'Set up Screen Time', description: 'Settings → Screen Time → set it up for a child (via Family Sharing). This is the enforced control for apps, content and downtime.' },
      { step: 2, title: 'Turn off iCloud Private Relay', description: 'Settings → Apple Account → iCloud → Private Relay → Off. While on, Safari/DNS filtering is bypassed via Apple\'s encrypted relay.' },
      { step: 3, title: 'Filter at the router', description: 'Set your home router DNS to <YOUR_DNS_SERVER_IP> for whole-home Wi-Fi filtering.' },
      { step: 4, title: 'Optional per-Wi-Fi DNS', description: 'Settings → Wi-Fi → (i) next to the network → Configure DNS → Manual → add <YOUR_DNS_SERVER_IP>. Per-network only; does not cover cellular.' },
    ],
    caveats: [
      'Per-Wi-Fi manual DNS does NOT filter Safari when iCloud Private Relay is on.',
      'Cellular data is not covered by manual/router DNS — rely on Screen Time / Content & Privacy Restrictions.',
      'For strong DNS enforcement Apple requires a DNS configuration profile (MDM/Family) rather than the per-Wi-Fi field.',
    ],
    videoUrl: 'https://support.apple.com/en-us/HT201304',
  },
  {
    platform: 'STEAM_DECK',
    title: 'Steam Deck — DNS & Family View',
    summary: 'Filters Steam network traffic. Steam Family View gates the library; offline games still run.',
    steps: [
      { step: 1, title: 'Open Internet settings', description: 'Steam button → Settings → Internet → select your Wi-Fi → Configure / IP settings.' },
      { step: 2, title: 'Set DNS manually', description: 'Switch IPv4 DNS to Manual and set <YOUR_DNS_SERVER_IP>.' },
      { step: 3, title: 'Enable Steam Family View', description: 'Settings → Family → Family View → set a PIN and choose which store/library/community features are allowed.' },
      { step: 4, title: 'Prefer router DNS', description: 'In Desktop mode the child can reach network settings — router-level DNS is harder to bypass.' },
    ],
    caveats: [
      'Desktop mode exposes full Linux settings — a determined child can change device DNS. Use router DNS.',
      'Offline Steam games cannot be stopped by DNS once installed.',
    ],
    videoUrl: 'https://store.steampowered.com/parental/',
  },
  {
    platform: 'SMART_TV',
    title: 'Smart TV / streaming box — DNS setup',
    summary: 'Filters streaming apps. No agent runs on a TV, so DNS (ideally at the router) is the only control.',
    steps: [
      { step: 1, title: 'Open network settings', description: 'Samsung: Settings → General/Connection → Network → Network Status → IP Settings. LG: Settings → Network → Wi-Fi Connection → Advanced. Similar on Sony/Hisense/Fire TV/Apple TV/Google TV.' },
      { step: 2, title: 'Switch DNS to Manual', description: 'Change DNS from Auto/Obtain automatically to Manual/Enter manually.' },
      { step: 3, title: 'Enter our DNS', description: 'Primary DNS: <YOUR_DNS_SERVER_IP>. Save.' },
      { step: 4, title: 'Restart the TV', description: 'Power-cycle so the new DNS takes effect.' },
      { step: 5, title: 'Best result: router DNS', description: 'Many TVs ignore or reset manual DNS — setting it at the router guarantees coverage.' },
    ],
    caveats: [
      'Some TV platforms hardcode their own DNS for app stores/telemetry and ignore the manual field — router DNS is the reliable path.',
      'DNS cannot stop content already playing from USB or an HDMI input.',
    ],
    videoUrl: 'https://www.samsung.com/us/support/answer/ANS00076727/',
  },
];
