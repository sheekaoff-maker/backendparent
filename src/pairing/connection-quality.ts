import { CONNECTION_QUALITY_THRESHOLDS_MS } from './pairing.constants';

/**
 * Computed, not persisted — a stored "quality" value would drift stale the
 * moment a heartbeat is missed without a background job to re-evaluate it.
 * Deriving it at read time from `lastDnsSeenAt` is cheap and always correct.
 */
export type ConnectionQuality = 'EXCELLENT' | 'GOOD' | 'POOR' | 'OFFLINE';

export function computeConnectionQuality(lastDnsSeenAt: Date | null, now: Date = new Date()): ConnectionQuality {
  if (!lastDnsSeenAt) return 'OFFLINE';
  const ageMs = now.getTime() - lastDnsSeenAt.getTime();
  if (ageMs < 0) return 'EXCELLENT'; // clock skew guard — treat future timestamps as "just now"
  if (ageMs <= CONNECTION_QUALITY_THRESHOLDS_MS.excellent) return 'EXCELLENT';
  if (ageMs <= CONNECTION_QUALITY_THRESHOLDS_MS.good) return 'GOOD';
  if (ageMs <= CONNECTION_QUALITY_THRESHOLDS_MS.poor) return 'POOR';
  return 'OFFLINE';
}
