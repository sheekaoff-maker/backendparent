import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RulesService } from '../rules/rules.service';
import { StartSessionDto, ExtendSessionDto } from './dto/session.dto';
import { SessionStatus } from '@prisma/client';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private rulesService: RulesService,
  ) {}

  async start(parentId: string, dto: StartSessionDto) {
    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
      include: { child: true },
    });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');
    if (!device.childId) throw new BadRequestException('Device not assigned to a child');

    const existingActive = await this.prisma.session.findFirst({
      where: { deviceId: dto.deviceId, status: SessionStatus.ACTIVE },
    });
    if (existingActive) throw new BadRequestException('Device already has an active session');

    const dailyLimit = await this.rulesService.getDailyLimit(device.childId);
    if (dailyLimit !== null) {
      const usedToday = await this.getUsedMinutesToday(device.childId);
      if (usedToday + dto.durationMinutes > dailyLimit) {
        throw new BadRequestException(
          `Daily limit exceeded. Used ${usedToday}/${dailyLimit} minutes today.`,
        );
      }
    }

    return this.prisma.session.create({
      data: {
        deviceId: dto.deviceId,
        childId: device.childId,
        parentId,
        status: SessionStatus.ACTIVE,
        durationMinutes: dto.durationMinutes,
        remainingMinutes: dto.durationMinutes,
        extendedMinutes: 0,
      },
    });
  }

  async pause(sessionId: string, parentId: string) {
    const session = await this.getAndValidate(sessionId, parentId);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is not active');
    }
    const elapsed = this.calculateElapsedMinutes(session.startedAt, session.resumedAt);
    const remaining = Math.max(0, session.durationMinutes + session.extendedMinutes - elapsed);
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.PAUSED,
        pausedAt: new Date(),
        remainingMinutes: remaining,
      },
    });
  }

  async resume(sessionId: string, parentId: string) {
    const session = await this.getAndValidate(sessionId, parentId);
    if (session.status !== SessionStatus.PAUSED) {
      throw new BadRequestException('Session is not paused');
    }
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ACTIVE,
        resumedAt: new Date(),
      },
    });
  }

  async extend(sessionId: string, parentId: string, dto: ExtendSessionDto) {
    const session = await this.getAndValidate(sessionId, parentId);
    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.PAUSED) {
      throw new BadRequestException('Session is not active or paused');
    }
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        extendedMinutes: session.extendedMinutes + dto.extraMinutes,
        remainingMinutes: session.remainingMinutes + dto.extraMinutes,
      },
    });
  }

  async stop(sessionId: string, parentId: string) {
    const session = await this.getAndValidate(sessionId, parentId);
    if (session.status === SessionStatus.STOPPED) {
      throw new BadRequestException('Session already stopped');
    }
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.STOPPED,
        stoppedAt: new Date(),
        remainingMinutes: 0,
      },
    });
  }

  async expire(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.EXPIRED,
        expiredAt: new Date(),
        remainingMinutes: 0,
      },
    });
  }

  async markViolated(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        violated: true,
        status: SessionStatus.VIOLATED,
      },
    });
  }

  async getActiveSessions(parentId: string) {
    return this.prisma.session.findMany({
      where: { parentId, status: SessionStatus.ACTIVE },
      include: { device: true, child: true },
    });
  }

  async getHistory(parentId: string) {
    return this.prisma.session.findMany({
      where: { parentId, status: { in: [SessionStatus.STOPPED, SessionStatus.EXPIRED, SessionStatus.VIOLATED] } },
      include: { device: true, child: true },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  calculateRemainingMinutes(session: {
    startedAt: Date;
    resumedAt: Date | null;
    pausedAt: Date | null;
    durationMinutes: number;
    extendedMinutes: number;
    status: string;
  }): number {
    if (session.status === SessionStatus.PAUSED) {
      return session.durationMinutes + session.extendedMinutes - this.calculateElapsedMinutes(session.startedAt, session.resumedAt);
    }
    if (session.status !== SessionStatus.ACTIVE) {
      return 0;
    }
    const elapsed = this.calculateElapsedMinutes(session.startedAt, session.resumedAt);
    return Math.max(0, session.durationMinutes + session.extendedMinutes - elapsed);
  }

  private calculateElapsedMinutes(startedAt: Date, resumedAt: Date | null): number {
    const referencePoint = resumedAt || startedAt;
    const now = new Date();
    const diffMs = now.getTime() - new Date(referencePoint).getTime();
    return Math.floor(diffMs / 60000);
  }

  private async getUsedMinutesToday(childId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sessions = await this.prisma.session.findMany({
      where: {
        childId,
        startedAt: { gte: startOfDay },
        status: { in: [SessionStatus.ACTIVE, SessionStatus.PAUSED, SessionStatus.STOPPED, SessionStatus.EXPIRED] },
      },
    });
    return sessions.reduce((total, s) => {
      return total + s.durationMinutes + s.extendedMinutes - s.remainingMinutes;
    }, 0);
  }

  private async getAndValidate(sessionId: string, parentId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.parentId !== parentId) throw new ForbiddenException('Not your session');
    return session;
  }
}
