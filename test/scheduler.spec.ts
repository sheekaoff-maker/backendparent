import { SchedulerService } from '../src/scheduler/scheduler.service';
import { SessionsService } from '../src/sessions/sessions.service';

/**
 * Time-accelerated tests for the schedule/session engine. No real waiting: we
 * feed a controlled "started long ago" timestamp to prove expiry, and a frozen
 * system clock (fake timers) to prove bedtime enforcement.
 */

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const shift = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60_000);

describe('SessionsService.calculateRemainingMinutes — expiry detection', () => {
  // Pure method; instantiate without the DI graph.
  const svc: SessionsService = Object.create(SessionsService.prototype);

  it('an ACTIVE session started well past its duration has 0 remaining (EXPIRED)', () => {
    const remaining = svc.calculateRemainingMinutes({
      startedAt: new Date(Date.now() - 180 * 60_000), // 3h ago
      resumedAt: null,
      pausedAt: null,
      durationMinutes: 60,
      extendedMinutes: 0,
      status: 'ACTIVE',
    });
    expect(remaining).toBe(0);
  });

  it('an ACTIVE session still within its window has time left', () => {
    const remaining = svc.calculateRemainingMinutes({
      startedAt: new Date(Date.now() - 5 * 60_000), // 5 min ago
      resumedAt: null,
      pausedAt: null,
      durationMinutes: 60,
      extendedMinutes: 0,
      status: 'ACTIVE',
    });
    expect(remaining).toBeGreaterThan(50);
    expect(remaining).toBeLessThanOrEqual(60);
  });

  it('extendedMinutes are credited toward remaining time', () => {
    const remaining = svc.calculateRemainingMinutes({
      startedAt: new Date(Date.now() - 65 * 60_000),
      resumedAt: null,
      pausedAt: null,
      durationMinutes: 60,
      extendedMinutes: 30, // 90 total, 65 elapsed → ~25 left
      status: 'ACTIVE',
    });
    expect(remaining).toBeGreaterThan(20);
  });
});

describe('SchedulerService.isWithinBedtime — window logic', () => {
  const svc: any = Object.create(SchedulerService.prototype);

  it('detects a time inside a same-day window', () => {
    expect(svc.isWithinBedtime('14:30', '14:00', '15:00')).toBe(true);
    expect(svc.isWithinBedtime('15:30', '14:00', '15:00')).toBe(false);
  });

  it('handles windows that wrap past midnight', () => {
    expect(svc.isWithinBedtime('23:30', '22:00', '07:00')).toBe(true);
    expect(svc.isWithinBedtime('03:00', '22:00', '07:00')).toBe(true);
    expect(svc.isWithinBedtime('12:00', '22:00', '07:00')).toBe(false);
  });
});

describe('SchedulerService.enforceDeviceSchedules — bedtime auto lock/unlock', () => {
  function build(deviceOverrides: Record<string, unknown>) {
    const update = jest.fn().mockResolvedValue({});
    const prisma: any = {
      device: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'd1',
            parentId: 'p1',
            childId: null,
            autoBlockEnabled: true,
            dailyLimitMinutes: null,
            internetLocked: false,
            internetLockedReason: null,
            ...deviceOverrides,
          },
        ]),
        update,
      },
      session: { aggregate: jest.fn().mockResolvedValue({ _sum: { durationMinutes: 0 } }) },
      categoryBlock: { upsert: jest.fn() },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new SchedulerService(prisma, {} as any, {} as any, {} as any, audit as any);
    return { svc, update };
  }

  it('LOCKS a device that is inside its bedtime window and not yet locked', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T23:00:00'));
    const now = new Date();
    const { svc, update } = build({
      bedtimeStart: hhmm(shift(now, -60)),
      bedtimeEnd: hhmm(shift(now, 60)),
      internetLocked: false,
    });
    await svc.enforceDeviceSchedules();
    jest.useRealTimers();
    expect(update).toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.internetLocked).toBe(true);
  });

  it('UNLOCKS a bedtime-locked device once the window has passed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T12:00:00'));
    const now = new Date();
    const { svc, update } = build({
      bedtimeStart: hhmm(shift(now, 120)),
      bedtimeEnd: hhmm(shift(now, 180)),
      internetLocked: true,
      internetLockedReason: 'Bedtime 22:00-07:00',
    });
    await svc.enforceDeviceSchedules();
    jest.useRealTimers();
    expect(update).toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.internetLocked).toBe(false);
  });

  it('does NOT touch a device outside bedtime that is already unlocked', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T12:00:00'));
    const now = new Date();
    const { svc, update } = build({
      bedtimeStart: hhmm(shift(now, 120)),
      bedtimeEnd: hhmm(shift(now, 180)),
      internetLocked: false,
    });
    await svc.enforceDeviceSchedules();
    jest.useRealTimers();
    expect(update).not.toHaveBeenCalled();
  });
});
