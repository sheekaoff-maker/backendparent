import { createHash } from 'crypto';

export interface DeviceFingerprintInput {
  macAddress?: string | null;
  hostname?: string | null;
  dhcpClientId?: string | null;
  vendorOui?: string | null;
}

function normalize(value?: string | null): string {
  return value ? value.trim().toLowerCase() : '';
}

/**
 * Stable identity hash for a device (Layer 4). Deliberately excludes IP
 * address (changes on every DHCP renewal) and OS hint (a heuristic, not a
 * stable identifier) — only fields that persist across reconnects go in.
 */
export function computeFingerprintHash(input: DeviceFingerprintInput): string {
  const parts = [
    normalize(input.macAddress),
    normalize(input.hostname),
    normalize(input.dhcpClientId),
    normalize(input.vendorOui),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
