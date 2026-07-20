import { computeConnectionQuality } from '../src/pairing/connection-quality';
import { extractPairToken, pairHostnameFor } from '../src/pairing/pairing.constants';

describe('computeConnectionQuality', () => {
  const now = new Date('2026-07-20T12:00:00Z');

  it('is OFFLINE when never seen', () => {
    expect(computeConnectionQuality(null, now)).toBe('OFFLINE');
  });

  it('is EXCELLENT within the last 2 minutes', () => {
    expect(computeConnectionQuality(new Date(now.getTime() - 60_000), now)).toBe('EXCELLENT');
  });

  it('is GOOD between 2 and 15 minutes', () => {
    expect(computeConnectionQuality(new Date(now.getTime() - 10 * 60_000), now)).toBe('GOOD');
  });

  it('is POOR between 15 minutes and 1 hour', () => {
    expect(computeConnectionQuality(new Date(now.getTime() - 40 * 60_000), now)).toBe('POOR');
  });

  it('is OFFLINE beyond 1 hour', () => {
    expect(computeConnectionQuality(new Date(now.getTime() - 2 * 60 * 60_000), now)).toBe('OFFLINE');
  });

  it('treats a future timestamp (clock skew) as EXCELLENT rather than throwing', () => {
    expect(computeConnectionQuality(new Date(now.getTime() + 5000), now)).toBe('EXCELLENT');
  });
});

describe('pair hostname pattern', () => {
  const token = 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789';

  it('round-trips a token through pairHostnameFor/extractPairToken', () => {
    const host = pairHostnameFor(token);
    expect(extractPairToken(host)).toBe(token.toLowerCase());
  });

  it('is case-insensitive and tolerates a trailing dot', () => {
    expect(extractPairToken(`${token.toUpperCase()}.pair.guardtime.local.`)).toBe(token.toLowerCase());
  });

  it('rejects a non-UUID label', () => {
    expect(extractPairToken('not-a-uuid.pair.guardtime.local')).toBeNull();
  });

  it('rejects a UUID under the wrong suffix', () => {
    expect(extractPairToken(`${token}.evil.example`)).toBeNull();
  });
});
