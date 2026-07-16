import { bucketDaily, resolveRange } from '../src/reports/reports.util';

const NOW = new Date('2026-07-16T09:30:00.000Z');

describe('resolveRange', () => {
  it('week offset 0 is a 7-day window ending today (exclusive = start of tomorrow)', () => {
    const r = resolveRange(NOW, 7, 0);
    expect(r.days).toBe(7);
    // end is start of the day AFTER today
    expect(r.end.getDate()).toBe(17);
    expect(r.end.getHours()).toBe(0);
    // start is 7 days before end
    expect(Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000)).toBe(7);
  });

  it('week offset 1 is the immediately previous 7-day window', () => {
    const cur = resolveRange(NOW, 7, 0);
    const prev = resolveRange(NOW, 7, 1);
    expect(prev.end.getTime()).toBe(cur.start.getTime());
  });

  it('clamps negative/NaN offset and days to safe values', () => {
    const r = resolveRange(NOW, 0, -5);
    expect(r.days).toBe(1);
    expect(r.end.getTime()).toBeGreaterThan(r.start.getTime());
  });

  it('month window is 30 days', () => {
    expect(resolveRange(NOW, 30, 0).days).toBe(30);
  });
});

describe('bucketDaily', () => {
  it('sums minutes into aligned per-day buckets and rounds', () => {
    const range = resolveRange(NOW, 7, 0);
    const day0 = new Date(range.start.getTime() + 3_600_000); // within first day
    const day2 = new Date(range.start.getTime() + 2 * 86_400_000 + 1000);
    const buckets = bucketDaily(
      [
        { at: day0, minutes: 20 },
        { at: day0, minutes: 10.4 },
        { at: day2, minutes: 45 },
      ],
      range,
    );
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toBe(30);
    expect(buckets[2]).toBe(45);
    expect(buckets[1]).toBe(0);
  });

  it('ignores items outside the window', () => {
    const range = resolveRange(NOW, 7, 0);
    const before = new Date(range.start.getTime() - 86_400_000);
    const after = new Date(range.end.getTime() + 86_400_000);
    const buckets = bucketDaily(
      [
        { at: before, minutes: 99 },
        { at: after, minutes: 99 },
      ],
      range,
    );
    expect(buckets.every((b) => b === 0)).toBe(true);
  });
});
