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

  private async expireSession(session: { id: string; parentId: string; deviceId: string; childId: string; device: { id: string; type: string; controlMethod: string; gatewayId: string | null } }) {
    this.logger.log(`Session ${session.id} expired`);

    await this.sessionsService.expire(session.id);

    const result = await this.enforcementService.handleOfflineViolation(
      session.device as any,
      session.id,
    );

    await this.notificationsService.create({
      userId: session.parentId,
      type: 'TIME_ENDED',
      title: 'Screen Time Ended',
      message: `Session expired on device. ${result.data?.offlineLimitation ? 'Offline games cannot be killed directly.' : ''}`,
      deviceId: session.deviceId,
      childId: session.childId,
      sessionId: session.id,
    });

    await this.auditService.log({
      userId: session.parentId,
      action: 'SESSION_EXPIRED',
      entity: 'session',
      entityId: session.id,
      details: `Device: ${session.deviceId}, offlineLimitation: ${!!result.data?.offlineLimitation}`,
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
