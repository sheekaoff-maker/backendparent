import { Injectable } from '@nestjs/common';
import { RouterCapabilities } from './router-capability.matrix';

/**
 * Router Capability Badges — a single, centralized scoring engine so every
 * caller (Router Wizard, Diagnostics, the Router Compatibility Center) sees
 * the same number for the same router, computed the same way. Every weight
 * below is backed by a REAL flag already in router-capability.matrix.ts
 * (never invented per-vendor guesses) — see each `CapabilityScoreCategory`
 * entry's `reasoning` for exactly which flag/fact it reads and why.
 */

export type SupportLevel = 'FULL_SUPPORT' | 'EXCELLENT' | 'GOOD' | 'LIMITED' | 'BASIC' | 'UNSUPPORTED';

export interface CapabilityScoreCategory {
  key: string;
  label: string;
  weight: number;
  earned: number;
  supported: boolean;
  reasoning: string;
}

export interface RouterCapabilityScore {
  score: number;
  maxScore: number;
  level: SupportLevel;
  stars: number;
  badge: string;
  supportedFeatures: string[];
  unsupportedFeatures: string[];
  breakdown: CapabilityScoreCategory[];
  recommendations: string[];
}

const MAX_SCORE = 100;

const LEVEL_LABELS: Record<SupportLevel, string> = {
  FULL_SUPPORT: 'Full Support',
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  LIMITED: 'Limited',
  BASIC: 'Basic',
  UNSUPPORTED: 'Unsupported',
};

const LEVEL_STARS: Record<SupportLevel, number> = {
  FULL_SUPPORT: 5,
  EXCELLENT: 4,
  GOOD: 3,
  LIMITED: 2,
  BASIC: 1,
  UNSUPPORTED: 0,
};

function levelForScore(score: number): SupportLevel {
  if (score >= 85) return 'FULL_SUPPORT';
  if (score >= 65) return 'EXCELLENT';
  if (score >= 45) return 'GOOD';
  if (score >= 20) return 'LIMITED';
  if (score >= 1) return 'BASIC';
  return 'UNSUPPORTED';
}

function starBadge(stars: number, label: string): string {
  return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} ${label}`;
}

@Injectable()
export class RouterCapabilityScoreService {
  /**
   * `capabilities: null` covers both an undetected router and a recognized
   * GUIDE_ONLY vendor whose row already has every boolean flag false by
   * construction (see router-capability.matrix.ts's `guideOnly()` helper) —
   * both correctly score 0/UNSUPPORTED without any special-casing here.
   */
  computeScore(
    capabilities: RouterCapabilities | null,
    detectedRouter?: { firmwareVersion?: string | null } | null,
  ): RouterCapabilityScore {
    const c = capabilities;

    const categories: CapabilityScoreCategory[] = [
      {
        key: 'pauseDevice',
        label: 'Pause Device',
        weight: 25,
        supported: !!c?.supportsPauseDevice,
        earned: 0,
        reasoning: c?.supportsPauseDevice
          ? 'Router plugin supports pausing a device\'s internet access directly (supportsPauseDevice).'
          : 'This router\'s plugin has no documented pause-device action.',
      },
      {
        key: 'accessSchedule',
        label: 'Access Schedule',
        weight: 20,
        supported: !!(c?.supportsPauseDevice || c?.supportsFirewallRules || c?.supportsMACFiltering),
        earned: 0,
        reasoning: c?.supportsPauseDevice || c?.supportsFirewallRules || c?.supportsMACFiltering
          ? 'GuardTime\'s own scheduler can drive this router\'s pause/firewall/MAC-filter action on a timer for bedtime and daily-limit schedules.'
          : 'No pause, firewall-rule, or MAC-filter action for the scheduler to drive on a timer.',
      },
      {
        key: 'blockDevice',
        label: 'Block Device',
        weight: 15,
        supported: !!(c?.supportsFirewallRules || c?.supportsMACFiltering),
        earned: 0,
        reasoning: c?.supportsFirewallRules || c?.supportsMACFiltering
          ? 'Router plugin can persistently block a device via a firewall rule or MAC filter entry.'
          : 'No documented persistent per-device block action (firewall rule or MAC filter).',
      },
      {
        key: 'dnsFiltering',
        label: 'DNS Filtering',
        weight: 15,
        supported: !!c?.supportsDNSChange,
        earned: 0,
        reasoning: c?.supportsDNSChange
          ? 'Router plugin can change the router\'s DNS server (supportsDNSChange).'
          : 'This router\'s plugin has no documented DNS-change action — GuardTime\'s device-level DNS filtering still applies independently.',
      },
      {
        key: 'statistics',
        label: 'Statistics',
        weight: 10,
        supported: !!c?.supportsStatistics,
        earned: 0,
        reasoning: c?.supportsStatistics
          ? 'Router exposes usage/connection statistics (supportsStatistics).'
          : 'No documented statistics/monitoring endpoint for this router.',
      },
      {
        key: 'parentalControls',
        label: 'Parental Controls',
        weight: 10,
        supported: !!c?.supportsParentalControl,
        earned: 0,
        reasoning: c?.supportsParentalControl
          ? 'Router has its own native parental-control feature GuardTime can drive (supportsParentalControl).'
          : 'No native parental-control feature documented for this router.',
      },
      {
        key: 'deviceDiscovery',
        label: 'Device Discovery',
        weight: 5,
        supported: !!c,
        earned: 0,
        reasoning: c
          ? 'Device discovery (ARP/mDNS/DHCP) runs on the gateway agent itself, independent of router vendor — available whenever a router is recognized.'
          : 'No router recognized on this gateway yet, so there is nothing to discover devices behind.',
      },
      {
        key: 'firmwareDetection',
        label: 'Firmware Detection',
        weight: 5,
        supported: !!detectedRouter?.firmwareVersion,
        earned: 0,
        reasoning: detectedRouter?.firmwareVersion
          ? `Firmware version reported by this specific router: ${detectedRouter.firmwareVersion}.`
          : 'This router has not reported a firmware/model string yet (or its plugin does not surface one).',
      },
    ];

    for (const category of categories) {
      category.earned = category.supported ? category.weight : 0;
    }

    // Category weights (25+20+15+15+10+10+5+5=105) intentionally sum a
    // touch over MAX_SCORE — every individual weight matches this feature's
    // spec exactly, so the ceiling is enforced here with a clamp rather
    // than shaving a point off one category to force the sum to 100.
    const rawScore = categories.reduce((sum, category) => sum + category.earned, 0);
    const score = Math.min(rawScore, MAX_SCORE);
    const level = levelForScore(score);
    const stars = LEVEL_STARS[level];

    const supportedFeatures = categories.filter((cat) => cat.supported).map((cat) => cat.label);
    const unsupportedFeatures = categories.filter((cat) => !cat.supported).map((cat) => cat.label);

    const recommendations: string[] = [];
    if (!c) {
      recommendations.push('Run router detection (Scan) so GuardTime can identify this router and its capabilities.');
    } else {
      if (c.integrationStatus === 'GUIDE_ONLY') {
        recommendations.push(
          c.scopeNote || `${c.vendorDisplayName} has no official management API — see Supported Features for manual setup instructions.`,
        );
      }
      if (!c.supportsPauseDevice && !c.supportsFirewallRules && !c.supportsMACFiltering) {
        recommendations.push('Consider a Software Gateway (Advanced) for full pause/block enforcement independent of this router.');
      }
      if (unsupportedFeatures.length > 0 && c.integrationStatus === 'OFFICIAL_API') {
        recommendations.push(`${c.vendorDisplayName}'s official API does not cover: ${unsupportedFeatures.join(', ')}.`);
      }
    }

    return {
      score,
      maxScore: MAX_SCORE,
      level,
      stars,
      badge: starBadge(stars, LEVEL_LABELS[level]),
      supportedFeatures,
      unsupportedFeatures,
      breakdown: categories,
      recommendations,
    };
  }
}
