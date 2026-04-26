import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpsertScheduleDto } from './dto/schedule.dto';

export type ProtectionLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ProtectionScoreResult {
  score: number;
  level: ProtectionLevel;
  breakdown: Record<string, number>;
}

@Injectable()
export class ProtectionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Compute a 0-100 protection score based on signals already in the DB.
   * Honest: this only reflects DNS visibility + offline-setup completeness;
   * it does NOT mean we can stop offline games.
   */
  async calculateProtectionScore(deviceId: string): Promise<ProtectionScoreResult> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { offlineChecklist: true },
    });
    if (!device) throw new NotFoundException('Device not found');

    const now = Date.now();
    const breakdown: Record<string, number> = {};

    // 1. DNS visibility (0-30): are we seeing queries from this device?
    let dnsScore = 0;
    if (device.dnsConfigured) dnsScore += 10;
    if (device.lastDnsSeenAt) {
      const ageMin = (now - device.lastDnsSeenAt.getTime()) / 60_000;
      if (ageMin <= 10) dnsScore += 20;
      else if (ageMin <= 60) dnsScore += 10;
      else if (ageMin <= 24 * 60) dnsScore += 5;
    }
    breakdown.dnsVisibility = dnsScore;

    // 2. Lock state (0-15): internet locked is a positive sign of active enforcement
    let lockScore = 0;
    if (device.internetLocked) lockScore += 15;
    else if (device.blockingMode === 'GAMING_ONLY') lockScore += 10;
    breakdown.lockState = lockScore;

    // 3. Offline setup (0-30): vendor controls completed
    let offlineScore = 0;
    if (device.offlineSetupVerified) offlineScore += 15;
    else if (device.offlineControlEnabled) offlineScore += 8;
    const cl = device.offlineChecklist;
    const checklistDone = cl
      ? [cl.pinEnabled, cl.childAccountLinked, cl.playTimeLimitEnabled, cl.ageRatingEnabled, cl.purchasesBlocked, cl.networkSettingsLocked].filter(Boolean).length
      : 0;
    offlineScore += Math.round((checklistDone / 6) * 15);
    breakdown.offlineSetup = offlineScore;

    // 4. Bypass history (0-25): subtract from a 25 baseline
    let bypassScore = 25;
    if (device.protectionStatus === 'POSSIBLE_DNS_BYPASS') bypassScore -= 10;
    if (device.protectionStatus === 'COMPROMISED') bypassScore = 0;
    bypassScore = Math.max(0, bypassScore - Math.min(20, device.bypassAttempts * 3));
    breakdown.bypassHistory = bypassScore;

    const score = Math.max(0, Math.min(100, dnsScore + lockScore + offlineScore + bypassScore));
    const level: ProtectionLevel = score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

    // persist (best-effort) so dashboards don't recompute every read
    await this.prisma.device.update({ where: { id: deviceId }, data: { protectionScore: score } }).catch(() => null);

    return { score, level, breakdown };
  }

  async getProtectionScore(parentId: string, deviceId: string) {
    await this.assertOwned(parentId, deviceId);
    return this.calculateProtectionScore(deviceId);
  }

  async getInsights(parentId: string, deviceId: string) {
    const device = await this.assertOwned(parentId, deviceId);
    const { score, level, breakdown } = await this.calculateProtectionScore(deviceId);
    const checklist = await this.prisma.offlineControlChecklist.findUnique({ where: { deviceId } });
    const checklistCompletedCount = checklist
      ? [checklist.pinEnabled, checklist.childAccountLinked, checklist.playTimeLimitEnabled, checklist.ageRatingEnabled, checklist.purchasesBlocked, checklist.networkSettingsLocked].filter(Boolean).length
      : 0;

    // Top domains queried in last 7 days (filter by sourceIp matching device IPs)
    const ips = [device.ipAddress, device.dnsSourceIp].filter(Boolean) as string[];
    const topRows = ips.length === 0
      ? []
      : await this.prisma.dnsQueryLog.groupBy({
          by: ['domain'],
          where: {
            sourceIp: { in: ips },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) },
          },
          _count: { domain: true },
          orderBy: { _count: { domain: 'desc' } },
          take: 10,
        }).catch(() => [] as any[]);
    const topDomains = topRows.map((r: any) => ({ domain: r.domain, count: r._count.domain }));

    const recommendations: string[] = [];
    if (!device.dnsConfigured) recommendations.push('Configure DNS at the router so this device cannot bypass filtering.');
    if (!device.offlineControlEnabled) recommendations.push('Open the offline-control setup guide and complete vendor steps.');
    if (checklistCompletedCount < 4) recommendations.push('Continue the offline-control checklist (PIN, child account, play-time, age rating).');
    if (device.protectionStatus === 'POSSIBLE_DNS_BYPASS') recommendations.push('Possible DNS bypass: re-check the device DNS settings.');
    if (device.protectionStatus === 'COMPROMISED') recommendations.push('Device flagged COMPROMISED: lock the network settings and verify the router DNS.');
    if (!device.internetLocked && level === 'LOW') recommendations.push('Consider FULL INTERNET LOCK while the score is low.');
    if (recommendations.length === 0) recommendations.push('All signals look healthy. Keep monitoring.');

    return {
      deviceId: device.id,
      protectionScore: score,
      protectionLevel: level,
      breakdown,
      protectionStatus: device.protectionStatus,
      lastDnsSeenAt: device.lastDnsSeenAt,
      bypassAttempts: device.bypassAttempts,
      lastBypassDetectedAt: device.lastBypassDetectedAt,
      checklistCompletedCount,
      topDomains,
      recommendations,
    };
  }

  async upsertSchedule(parentId: string, deviceId: string, dto: UpsertScheduleDto) {
    await this.assertOwned(parentId, deviceId);
    const data: any = {};
    for (const k of ['dailyLimitMinutes', 'bedtimeStart', 'bedtimeEnd', 'autoBlockEnabled']) {
      if ((dto as any)[k] !== undefined) data[k] = (dto as any)[k];
    }
    return this.prisma.device.update({ where: { id: deviceId }, data });
  }

  async getSchedule(parentId: string, deviceId: string) {
    const device = await this.assertOwned(parentId, deviceId);
    return {
      deviceId: device.id,
      dailyLimitMinutes: device.dailyLimitMinutes,
      bedtimeStart: device.bedtimeStart,
      bedtimeEnd: device.bedtimeEnd,
      autoBlockEnabled: device.autoBlockEnabled,
    };
  }

  private async assertOwned(parentId: string, deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId }, include: { offlineChecklist: true } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');
    return device;
  }
}
