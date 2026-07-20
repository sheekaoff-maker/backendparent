/**
 * DNS auto-pairing constants.
 *
 * How the probe query reaches the resolver, and why: a device's normal OS
 * DNS resolver cannot carry an app-level pairing token — DNS has no such
 * field, and during pairing the device isn't even pointed at GuardTime's
 * resolver yet (that's the whole point of pairing). The parent's phone
 * instead sends one raw UDP query, directly to the resolver's IP, for the
 * hostname `<token>.pair.guardtime.local` — bypassing the phone's own OS
 * resolver entirely (Flutter opens a raw socket, see
 * pairing_probe_service.dart). That query's source IP is the household's
 * public IP (every device behind one home router shares it via NAT), which
 * is exactly the value that needs registering — the same pattern NextDNS
 * calls "Linked IP" and Circle uses for its own auto-provisioning.
 *
 * `pair.guardtime.local` is never meant to resolve on the public internet
 * — it's an opaque label the resolver pattern-matches on, not a delegated
 * DNS zone.
 */
export const PAIR_DOMAIN_SUFFIX = process.env.PAIR_DOMAIN_SUFFIX || 'pair.guardtime.local';

export const PAIR_TOKEN_TTL_MS = 10 * 60_000; // 10 minutes, per spec

/** Caps retries against one still-WAITING session (see PairingService). */
export const PAIR_MAX_CONFIRM_ATTEMPTS = 5;

/**
 * A device is considered actively connected if its last DNS heartbeat
 * (any resolved query, not just pairing) was within this window — used to
 * derive ConnectionQuality without persisting a value that would go stale
 * between heartbeats.
 */
export const CONNECTION_QUALITY_THRESHOLDS_MS = {
  excellent: 2 * 60_000, // last seen < 2 min ago
  good: 15 * 60_000, // < 15 min
  poor: 60 * 60_000, // < 1 hour — beyond this, OFFLINE
} as const;

export function pairHostnameFor(token: string): string {
  return `${token}.${PAIR_DOMAIN_SUFFIX}`;
}

const PAIR_HOSTNAME_PATTERN = new RegExp(
  `^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.${PAIR_DOMAIN_SUFFIX.replace(/\./g, '\\.')}$`,
  'i',
);

/** Extracts the pair token from a resolved query domain, or null if it doesn't match the pairing pattern. */
export function extractPairToken(domain: string): string | null {
  const lower = domain.toLowerCase().replace(/\.$/, '');
  const match = PAIR_HOSTNAME_PATTERN.exec(lower);
  return match ? match[1] : null;
}
