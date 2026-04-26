export interface GuideStep {
  step: number;
  title: string;
  description: string;
}

export interface SetupGuideData {
  platform: string;
  title: string;
  steps: GuideStep[];
  videoUrl?: string;
}

export const SETUP_GUIDES: SetupGuideData[] = [
  {
    platform: 'PLAYSTATION',
    title: 'PlayStation Family / Parental Controls',
    steps: [
      { step: 1, title: 'Sign in as the Family Manager', description: 'On your PS5 / PS4, sign in with the parent account that created the family.' },
      { step: 2, title: 'Open Family Management', description: 'Settings → Family and Parental Controls → Family Management.' },
      { step: 3, title: 'Pick your child', description: 'Select the child account you want to control.' },
      { step: 4, title: 'Set Play Time Settings', description: 'Configure daily play time, bedtime, and which days are allowed.' },
      { step: 5, title: 'Set Parental Controls', description: 'Restrict age rating for games, blu-ray, web browser. Block PSN communication if needed.' },
      { step: 6, title: 'Configure DNS on your router (recommended)', description: 'Point your home router DNS to our DNS server IP so all PlayStation online traffic is filtered.' },
    ],
    videoUrl: 'https://www.playstation.com/en-us/support/account/ps5-parental-controls/',
  },
  {
    platform: 'NINTENDO',
    title: 'Nintendo Switch Parental Controls',
    steps: [
      { step: 1, title: 'Install the app', description: 'Download "Nintendo Switch Parental Controls" on your phone (iOS / Android).' },
      { step: 2, title: 'Link the Switch', description: 'On the Switch: System Settings → Parental Controls → Use Smartphone App. Scan the QR shown in the app.' },
      { step: 3, title: 'Set play time limits', description: 'In the app set daily play time, bedtime alarm, and which days the Switch can be used.' },
      { step: 4, title: 'Set software restrictions', description: 'Restrict by age rating, block free communication, social posting, and the eShop.' },
      { step: 5, title: 'Configure DNS on Switch', description: 'System Settings → Internet → Network → change DNS to your home router or directly to our DNS server IP.' },
    ],
    videoUrl: 'https://www.nintendo.com/us/switch/parental-controls/',
  },
  {
    platform: 'XBOX',
    title: 'Xbox Family Settings',
    steps: [
      { step: 1, title: 'Install the Xbox Family Settings app', description: 'Available on iOS / Android.' },
      { step: 2, title: 'Sign in with your Microsoft account', description: 'Use the parent account that owns the family group.' },
      { step: 3, title: 'Add your child', description: 'family.microsoft.com → Add a member → child account. They must sign in on the Xbox at least once.' },
      { step: 4, title: 'Set screen time + content limits', description: 'In the app: screen time per day per device, content age limits, ask-to-buy, multiplayer toggle.' },
      { step: 5, title: 'Connect to our backend (optional)', description: 'In the parent app, tap "Link Xbox account" → log in with Microsoft → we will sync time limits and blocks.' },
    ],
    videoUrl: 'https://support.xbox.com/en-US/help/family-online-safety/online-safety/xbox-family-settings-app',
  },
  {
    platform: 'SMART_TV',
    title: 'Smart TV — Configure DNS for filtering',
    steps: [
      { step: 1, title: 'Open TV network settings', description: 'On Samsung / LG / Sony / Hisense: Settings → Network → Network Status → IP Settings.' },
      { step: 2, title: 'Switch DNS to manual', description: 'Change DNS Setting from Auto to Manual.' },
      { step: 3, title: 'Enter our DNS server IP', description: 'Primary DNS: <YOUR_DNS_SERVER_IP>. Save.' },
      { step: 4, title: 'Restart the TV', description: 'Power-cycle the TV so the new DNS takes effect.' },
      { step: 5, title: 'Best result: change DNS on the router', description: 'For TVs that cannot be configured, set the DNS at your router so every device on the network uses it.' },
    ],
  },
  {
    platform: 'ROUTER',
    title: 'Router-level DNS filtering (covers ALL devices)',
    steps: [
      { step: 1, title: 'Open your router admin page', description: 'Usually 192.168.1.1 or 192.168.0.1 in your browser.' },
      { step: 2, title: 'Sign in', description: 'Login is on a sticker on the router. Default is often admin / admin.' },
      { step: 3, title: 'Find DNS / DHCP settings', description: 'Look for "Internet", "WAN", or "LAN / DHCP". The DNS server fields are usually there.' },
      { step: 4, title: 'Set our DNS', description: 'Primary DNS: <YOUR_DNS_SERVER_IP>. Secondary: 1.1.1.1.' },
      { step: 5, title: 'Save and reboot', description: 'Restart the router. All devices in the home will now go through our filter.' },
    ],
  },
];
