import { BlockCategory } from '@prisma/client';

export interface SeedDomain {
  domain: string;
  category: BlockCategory;
  wildcard: boolean;
}

/**
 * Curated list of well-known gaming/streaming/social domains.
 * Wildcard=true means the domain itself + any subdomain is blocked.
 */
export const SEED_DOMAINS: SeedDomain[] = [
  // ===== GAMING =====
  // Xbox / Microsoft
  { domain: 'xboxlive.com', category: 'GAMING', wildcard: true },
  { domain: 'xbox.com', category: 'GAMING', wildcard: true },
  { domain: 'xboxservices.com', category: 'GAMING', wildcard: true },
  // PlayStation
  { domain: 'playstation.net', category: 'GAMING', wildcard: true },
  { domain: 'playstation.com', category: 'GAMING', wildcard: true },
  { domain: 'sonyentertainmentnetwork.com', category: 'GAMING', wildcard: true },
  // Nintendo
  { domain: 'nintendo.net', category: 'GAMING', wildcard: true },
  { domain: 'nintendo.com', category: 'GAMING', wildcard: true },
  { domain: 'nintendoswitch.com', category: 'GAMING', wildcard: true },
  // Steam / Valve
  { domain: 'steampowered.com', category: 'GAMING', wildcard: true },
  { domain: 'steamcommunity.com', category: 'GAMING', wildcard: true },
  { domain: 'steamcontent.com', category: 'GAMING', wildcard: true },
  { domain: 'steamstatic.com', category: 'GAMING', wildcard: true },
  // Epic Games / Fortnite
  { domain: 'epicgames.com', category: 'GAMING', wildcard: true },
  { domain: 'unrealengine.com', category: 'GAMING', wildcard: true },
  { domain: 'fortnite.com', category: 'GAMING', wildcard: true },
  // Roblox
  { domain: 'roblox.com', category: 'GAMING', wildcard: true },
  { domain: 'rbxcdn.com', category: 'GAMING', wildcard: true },
  // EA / Battle.net / Ubisoft / Riot
  { domain: 'ea.com', category: 'GAMING', wildcard: true },
  { domain: 'easports.com', category: 'GAMING', wildcard: true },
  { domain: 'battle.net', category: 'GAMING', wildcard: true },
  { domain: 'blizzard.com', category: 'GAMING', wildcard: true },
  { domain: 'ubisoft.com', category: 'GAMING', wildcard: true },
  { domain: 'ubi.com', category: 'GAMING', wildcard: true },
  { domain: 'riotgames.com', category: 'GAMING', wildcard: true },
  { domain: 'leagueoflegends.com', category: 'GAMING', wildcard: true },
  // Minecraft / Mojang
  { domain: 'minecraft.net', category: 'GAMING', wildcard: true },
  { domain: 'mojang.com', category: 'GAMING', wildcard: true },
  // Other
  { domain: 'rockstargames.com', category: 'GAMING', wildcard: true },
  { domain: 'take2games.com', category: 'GAMING', wildcard: true },
  { domain: 'activision.com', category: 'GAMING', wildcard: true },
  { domain: 'callofduty.com', category: 'GAMING', wildcard: true },
  { domain: 'discord.com', category: 'GAMING', wildcard: true },
  { domain: 'discord.gg', category: 'GAMING', wildcard: true },
  { domain: 'twitch.tv', category: 'GAMING', wildcard: true },

  // ===== STREAMING =====
  { domain: 'youtube.com', category: 'STREAMING', wildcard: true },
  { domain: 'youtu.be', category: 'STREAMING', wildcard: true },
  { domain: 'googlevideo.com', category: 'STREAMING', wildcard: true },
  { domain: 'netflix.com', category: 'STREAMING', wildcard: true },
  { domain: 'nflxvideo.net', category: 'STREAMING', wildcard: true },
  { domain: 'primevideo.com', category: 'STREAMING', wildcard: true },
  { domain: 'disneyplus.com', category: 'STREAMING', wildcard: true },
  { domain: 'hulu.com', category: 'STREAMING', wildcard: true },
  { domain: 'hbomax.com', category: 'STREAMING', wildcard: true },
  { domain: 'spotify.com', category: 'STREAMING', wildcard: true },
  { domain: 'tiktok.com', category: 'STREAMING', wildcard: true },
  { domain: 'tiktokcdn.com', category: 'STREAMING', wildcard: true },

  // ===== SOCIAL =====
  { domain: 'facebook.com', category: 'SOCIAL', wildcard: true },
  { domain: 'fbcdn.net', category: 'SOCIAL', wildcard: true },
  { domain: 'instagram.com', category: 'SOCIAL', wildcard: true },
  { domain: 'cdninstagram.com', category: 'SOCIAL', wildcard: true },
  { domain: 'twitter.com', category: 'SOCIAL', wildcard: true },
  { domain: 'x.com', category: 'SOCIAL', wildcard: true },
  { domain: 'snapchat.com', category: 'SOCIAL', wildcard: true },
  { domain: 'reddit.com', category: 'SOCIAL', wildcard: true },
  { domain: 'pinterest.com', category: 'SOCIAL', wildcard: true },
  { domain: 'whatsapp.com', category: 'SOCIAL', wildcard: true },
  { domain: 'telegram.org', category: 'SOCIAL', wildcard: true },

  // ===== ADULT =====
  { domain: 'pornhub.com', category: 'ADULT', wildcard: true },
  { domain: 'xvideos.com', category: 'ADULT', wildcard: true },
  { domain: 'xnxx.com', category: 'ADULT', wildcard: true },
  { domain: 'xhamster.com', category: 'ADULT', wildcard: true },
  { domain: 'redtube.com', category: 'ADULT', wildcard: true },
  { domain: 'youporn.com', category: 'ADULT', wildcard: true },
];
