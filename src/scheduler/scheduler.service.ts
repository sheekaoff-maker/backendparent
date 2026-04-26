import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { EnforcementService } from '../enforcement/enforcement.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { SessionStatus } from '@prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private sessionsService: SessionsService,
    private enforcementService: EnforcementService,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkActiveSessions() {
    this.logger.debug('Checking active sessions...');
    const activeSessions = await this.prisma.session.findMany({
      where: { status: SessionStatus.ACTIVE },
      include: { device: true },
    });

    for (const session of activeSessions) {
      const remaining = this.sessionsService.calculateRemainingMinutes(session);

      if (remaining <= 0) {
        await this.expireSession(session);
      } else if (remaining <= 10) {
        await this.notifyTenMinutesLeft(session, remaining);
      }

      await this.sessionsService.calculateRemainingMinutes(session);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkRulesAndSchedules() {
    this.logger.debug('Checking rules and schedules...');
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const currentDay = now.getDay().toString();

    const bedtimeRules = await this.prisma.rule.findMany({
      where: { type: 'BEDTIME', active: true, startTime: currentTime },
      include: { child: { include: { devices: true } } },
    });

    for (const rule of bedtimeRules) {
      if (rule.daysOfWeek && !rule.daysOfWeek.split(',').includes(currentDay)) continue;

      for (const device of rule.child.devices) {
        this.logger.log(`Bedtime rule triggered for device ${device.id}`);
        const result = await this.enforcementService.blockDevice(device.id, `Bedtime rule: ${rule.startTime}-${rule.endTime}`);
        if (result.success) {
          await this.auditService.log({
            action: 'BEDTIME_ENFORCED',
            entity: 'device',
            entityId: device.id,
            details: `Rule ${rule.id}: bedtime ${rule.startTime}-${rule.endTime}`,
          });
        }
      }
    }
  }

  /**
   * Detect possible DNS bypass: a device is internet-locked but our DNS server has not
   * seen a query from it for more than STALE_THRESHOLD_MIN minutes. The child likely
   * changed DNS, started a VPN, or used a hotspot. Mark protectionStatus and notify.
   *
   * Repeats: every detection increments bypassAttempts. Once it crosses
   * COMPROMISED_THRESHOLD, status escalates to COMPROMISED and we send a stronger
   * REPEATED_BYPASS notification.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async detectDnsBypass() {
    const STALE_THRESHOLD_MIN = 10;
    const COMPROMISED_THRESHOLD = 3;
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MIN * 60_000);

    const suspect = await this.prisma.device.findMany({
      where: {
        internetLocked: true,
        protectionStatus: { not: 'COMPROMISED' },
        OR: [
          { lastDnsSeenAt: null },
          { lastDnsSeenAt: { lt: cutoff } },
        ],
        internetLockedAt: { lt: cutoff },
      },
    });

    for (const device of suspect) {
      const newAttempts = device.bypassAttempts + 1;
      const escalate = newAttempts >= COMPROMISED_THRESHOLD;
      const newStatus = escalate ? 'COMPROMISED' : 'POSSIBLE_DNS_BYPASS';
      this.logger.warn(
        `[DNS-bypass] device ${device.id} attempts=${newAttempts} status=${newStatus}`,
      );
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          protectionStatus: newStatus,
          bypassAttempts: newAttempts,
          lastBypassDetectedAt: new Date(),
        },
      });
      await this.notificationsService.create({
        userId: device.parentId,
        type: escalate ? 'REPEATED_BYPASS' : 'POSSIBLE_DNS_BYPASS',
        title: escalate ? 'Repeated DNS bypass — device COMPROMISED' : 'Possible DNS bypass detected',
        message: escalate
          ? `Device "${device.name}" has bypassed DNS ${newAttempts} times. Marked COMPROMISED — re-check router DNS, lock device network settings, or consider a hotspot block.`
          : `Device "${device.name}" is locked but our DNS server hasn't seen any traffic from it. The child may have changed DNS, started a VPN, or switched to a hotspot.`,
        deviceId: device.id,
        childId: device.childId ?? undefined,
      });
      await this.auditService.log({
        userId: device.parentId,
        action: escalate ? 'DEVICE_COMPROMISED' : 'DNS_BYPASS_DETECTED',
        entity: 'device',
        entityId: device.id,
        details: `attempts=${newAttempts}, lastDnsSeenAt=${device.lastDnsSeenAt?.toISOString() ?? 'null'}`,
      });
    }
  }

  /**
   * Smart auto-block: per-device daily-limit + bedtime enforcement.
   * Respects autoBlockEnabled — opt-in only.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async enforceDeviceSchedules() {
    const devices = await this.prisma.device.findMany({
      where: { autoBlockEnabled: true },
    });
    if (devices.length === 0) return;
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    for (const device of devices) {
      try {
        const inBedtime =
          !!device.bedtimeStart && !!device.bedtimeEnd &&
          this.isWithinBedtime(currentTime, device.bedtimeStart, device.bedtimeEnd);

        if (inBedtime && !device.internetLocked) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: {
              internetLocked: true,
              blockingMode: 'FULL_INTERNET_LOCK',
              internetLockedReason: `Bedtime ${device.bedtimeStart}-${device.bedtimeEnd}`,
              internetLockedAt: now,
            },
          });
          await this.auditService.log({
            userId: device.parentId,
            action: 'BEDTIME_LOCK',
            entity: 'device',
            entityId: device.id,
            details: `Auto-locked at ${currentTime}`,
          });
          continue;
        }
        if (!inBedtime && device.internetLocked && device.internetLockedReason?.startsWith('Bedtime')) {
          // bedtime ended — auto-unlock
          await this.prisma.device.update({
            where: { id: device.id },
            data: {
              internetLocked: false,
              blockingMode: 'GAMING_ONLY',
              internetLockedReason: null,
              internetLockedAt: null,
            },
          });
          await this.auditService.log({
            userId: device.parentId,
            action: 'BEDTIME_UNLOCK',
            entity: 'device',
            entityId: device.id,
            details: `Auto-unlocked at ${currentTime}`,
          });
        }

        // Daily limit: today's total session minutes vs dailyLimitMinutes
        if (device.dailyLimitMinutes && device.childId) {
          const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
          const aggregate = await this.prisma.session.aggregate({
            where: { deviceId: device.id, startedAt: { gte: startOfDay } },
            _sum: { durationMinutes: true },
          });
          const used = aggregate._sum.durationMinutes ?? 0;
          if (used >= device.dailyLimitMinutes) {
            await this.prisma.categoryBlock.upsert({
              where: { childId_category: { childId: device.childId, category: 'GAMING' } },
              update: { active: true, reason: 'Daily limit exceeded' },
              create: { childId: device.childId, category: 'GAMING', active: true, reason: 'Daily limit exceeded' },
            });
            await this.auditService.log({
              userId: device.parentId,
              action: 'DAILY_LIMIT_BLOCK',
              entity: 'device',
              entityId: device.id,
              details: `used=${used}min, limit=${device.dailyLimitMinutes}min`,
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`schedule enforce failed for ${device.id}: ${err.message}`);
      }
    }
  }

  /**
   * Notify parents whose device protectionScore drops below 50. Uses a daily
   * de-dupe via NotificationEvent.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async notifyLowProtection() {
    const lowScoreDevices = await this.prisma.device.findMany({
      where: { protectionScore: { lt: 50 } },
    });
    for (const device of lowScoreDevices) {
      const recent = await this.prisma.notificationEvent.findFirst({
        where: {
          deviceId: device.id,
          type: 'PROTECTION_LOW',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
        },
      });
      if (recent) continue;
      await this.notificationsService.create({
        userId: device.parentId,
        type: 'PROTECTION_LOW',
        title: 'Low protection score',
        message: `Device "${device.name}" has a protection score of ${device.protectionScore}/100. Open insights to see recommendations.`,
        deviceId: device.id,
        childId: device.childId ?? undefined,
      });
    }
  }

  private isWithinBedtime(now: string, start: string, end: string): boolean {
    const toMin = (s: string) => {
      const [h, m] = s.split(':').map(Number);
      return h * 60 + m;
    };
    const n = toMin(now), s = toMin(start), e = toMin(end);
    return s <= e ? n >= s && n < e : n >= s || n < e; // wraps midnight
  }

  private async expireSession(session: { id: string; parentId: string; deviceId: string; childId: string; device: { id: string; type: string; controlMethod: string; gatewayId: string | null } }) {
    this.logger.log(`Session ${session.id} expired`);

    await this.sessionsService.expire(session.id);

    const result = await this.enforcementService.handleOfflineViolation(
      session.device as any,
      session.id,
    );

    // Auto-block GAMING category for the child so DNS keeps blocking online games
    // even after the session ends. Parent must manually unblock to give more time.
    try {
      await this.prisma.categoryBlock.upsert({
        where: { childId_category: { childId: session.childId, category: 'GAMING' } },
        update: { active: true, reason: `Session ${session.id} expired` },
        create: {
          childId: session.childId,
          category: 'GAMING',
          active: true,
          reason: `Session ${session.id} expired`,
        },
      });
      this.logger.log(`GAMING category auto-blocked for child ${session.childId}`);
    } catch (err: any) {
      this.logger.warn(`Failed to auto-block GAMING: ${err.message}`);
    }

    await this.notificationsService.create({
      userId: session.parentId,
      type: 'TIME_ENDED',
      title: 'Screen Time Ended',
      message: `Session expired on device. Online gaming has been auto-blocked. ${result.data?.offlineLimitation ? 'Note: offline games cannot be killed directly — see device-specific guides.' : ''}`,
      deviceId: session.deviceId,
      childId: session.childId,
      sessionId: session.id,
    });

    await this.auditService.log({
      userId: session.parentId,
      action: 'SESSION_EXPIRED',
      entity: 'session',
      entityId: session.id,
      details: `Device: ${session.deviceId}, offlineLimitation: ${!!result.data?.offlineLimitation}, gamingCategoryBlocked: true`,
    });
  }

  private async notifyTenMinutesLeft(session: { id: string; parentId: string; deviceId: string; childId: string; remainingMinutes: number }, remaining: number) {
    const tenMinNotif = await this.prisma.notificationEvent.findFirst({
      where: {
        sessionId: session.id,
        type: 'TIME_10_MIN_LEFT',
        createdAt: { gte: new Date(Date.now() - 600000) },
      },
    });

    if (!tenMinNotif) {
      await this.notificationsService.create({
        userId: session.parentId,
        type: 'TIME_10_MIN_LEFT',
        title: '10 Minutes Left',
        message: `Screen time has ${remaining} minutes remaining`,
        deviceId: session.deviceId,
        childId: session.childId,
        sessionId: session.id,
      });
    }
  }
}
