import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../common/prisma.service';
import { bucketDaily, resolveRange } from './reports.util';

export interface ReportChildBreakdown {
  childId: string;
  name: string;
  screenMinutes: number;
  sessions: number;
}

export interface ReportTopApp {
  name: string;
  minutes: number;
}

export interface ReportDeviceActivity {
  deviceId: string;
  name: string;
  type: string;
  protected: boolean;
}

export interface PeriodReport {
  period: 'week' | 'month';
  start: string;
  end: string;
  label: string;
  scope: { childId: string | null };
  sessionsCount: number;
  screenMinutes: number;
  trackedMinutes: number;
  gamingMinutes: number;
  dailyMinutes: number[];
  topApps: ReportTopApp[];
  byChild: ReportChildBreakdown[];
  devices: ReportDeviceActivity[];
  protectedDevices: number;
  totalDevices: number;
  generatedAt: string;
}

const FRESH_MINUTES = 15;
const REPORT_TTL_MS = 5 * 60_000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  weekly(parentId: string, childId: string | undefined, offset: number) {
    return this.build('week', 7, offset, parentId, childId);
  }

  monthly(parentId: string, childId: string | undefined, offset: number) {
    return this.build('month', 30, offset, parentId, childId);
  }

  private async build(
    period: 'week' | 'month',
    days: number,
    offset: number,
    parentId: string,
    childId: string | undefined,
  ): Promise<PeriodReport> {
    const cacheKey = `report:${parentId}:${childId ?? 'all'}:${period}:${offset}`;
    const cached = await this.cache.get<PeriodReport>(cacheKey);
    if (cached) return cached;

    const range = resolveRange(new Date(), days, offset);

    const children = await this.prisma.child.findMany({
      where: { parentId, ...(childId ? { id: childId } : {}) },
      select: { id: true, name: true },
    });
    if (childId && children.length === 0) {
      throw new ForbiddenException('Not your child');
    }
    const childIds = children.map((c) => c.id);
    const childNames = new Map(children.map((c) => [c.id, c.name]));

    const [sessions, topAppsRaw, gamingAgg, trackedAgg, devices] = await Promise.all([
      this.prisma.session.findMany({
        where: {
          parentId,
          startedAt: { gte: range.start, lt: range.end },
          ...(childId ? { childId } : {}),
        },
        select: { durationMinutes: true, startedAt: true, childId: true },
      }),
      childIds.length
        ? this.prisma.usageLog.groupBy({
            by: ['appName'],
            where: { childId: { in: childIds }, loggedAt: { gte: range.start, lt: range.end } },
            _sum: { durationSec: true },
            orderBy: { _sum: { durationSec: 'desc' } },
            take: 5,
          })
        : Promise.resolve([] as Array<{ appName: string | null; _sum: { durationSec: number | null } }>),
      childIds.length
        ? this.prisma.usageLog.aggregate({
            where: {
              childId: { in: childIds },
              loggedAt: { gte: range.start, lt: range.end },
              category: { equals: 'GAMING', mode: 'insensitive' },
            },
            _sum: { durationSec: true },
          })
        : Promise.resolve({ _sum: { durationSec: 0 } }),
      childIds.length
        ? this.prisma.usageLog.aggregate({
            where: { childId: { in: childIds }, loggedAt: { gte: range.start, lt: range.end } },
            _sum: { durationSec: true },
          })
        : Promise.resolve({ _sum: { durationSec: 0 } }),
      this.prisma.device.findMany({
        where: { parentId },
        select: { id: true, name: true, type: true, lastDnsSeenAt: true },
      }),
    ]);

    const screenMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const dailyMinutes = bucketDaily(
      sessions.map((s) => ({ at: s.startedAt, minutes: s.durationMinutes })),
      range,
    );

    const byChildMap = new Map<string, ReportChildBreakdown>();
    for (const s of sessions) {
      const entry =
        byChildMap.get(s.childId) ??
        {
          childId: s.childId,
          name: childNames.get(s.childId) ?? 'Child',
          screenMinutes: 0,
          sessions: 0,
        };
      entry.screenMinutes += s.durationMinutes;
      entry.sessions += 1;
      byChildMap.set(s.childId, entry);
    }

    const now = Date.now();
    const deviceActivity: ReportDeviceActivity[] = devices.map((d) => ({
      deviceId: d.id,
      name: d.name,
      type: d.type,
      protected:
        d.lastDnsSeenAt !== null &&
        now - d.lastDnsSeenAt.getTime() <= FRESH_MINUTES * 60_000,
    }));
    const protectedDevices = deviceActivity.filter((d) => d.protected).length;

    const report: PeriodReport = {
      period,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      label: range.label,
      scope: { childId: childId ?? null },
      sessionsCount: sessions.length,
      screenMinutes,
      trackedMinutes: Math.round((trackedAgg._sum.durationSec ?? 0) / 60),
      gamingMinutes: Math.round((gamingAgg._sum.durationSec ?? 0) / 60),
      dailyMinutes,
      topApps: topAppsRaw.map((row) => ({
        name: row.appName ?? 'Unknown',
        minutes: Math.round((row._sum.durationSec ?? 0) / 60),
      })),
      byChild: [...byChildMap.values()].sort((a, b) => b.screenMinutes - a.screenMinutes),
      devices: deviceActivity,
      protectedDevices,
      totalDevices: deviceActivity.length,
      generatedAt: new Date().toISOString(),
    };

    await this.cache.set(cacheKey, report, REPORT_TTL_MS);
    return report;
  }
}
