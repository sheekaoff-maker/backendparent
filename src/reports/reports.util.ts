/**
 * Pure date-range and bucketing helpers for reports. No I/O — fully
 * unit-testable so the aggregation logic is verifiable without a database.
 */

export interface ReportRange {
  start: Date;
  /** Exclusive upper bound (start of the day after the last day). */
  end: Date;
  days: number;
  label: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * A rolling window of [days] ending today, shifted back by [offset] windows.
 * offset 0 = the most recent window ending today; offset 1 = the one before.
 */
export function resolveRange(now: Date, days: number, offset: number): ReportRange {
  const safeDays = Math.max(1, Math.floor(days));
  const safeOffset = Math.max(0, Math.floor(offset));

  // Exclusive upper bound = start of tomorrow, shifted back by whole windows.
  const end = startOfDay(now);
  end.setDate(end.getDate() + 1 - safeDays * safeOffset);
  const start = new Date(end);
  start.setDate(start.getDate() - safeDays);

  const lastDay = new Date(end.getTime() - MS_PER_DAY);
  return { start, end, days: safeDays, label: `${fmt(start)} – ${fmt(lastDay)}` };
}

/**
 * Sum values into per-day buckets aligned to [range]. Returns an array of
 * length range.days; index 0 is the first day of the window.
 */
export function bucketDaily(
  items: Array<{ at: Date; minutes: number }>,
  range: ReportRange,
): number[] {
  const buckets = new Array<number>(range.days).fill(0);
  for (const item of items) {
    const idx = Math.floor((item.at.getTime() - range.start.getTime()) / MS_PER_DAY);
    if (idx >= 0 && idx < range.days) {
      buckets[idx] += item.minutes;
    }
  }
  return buckets.map((m) => Math.round(m));
}
