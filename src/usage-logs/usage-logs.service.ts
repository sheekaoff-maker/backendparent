import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUsageLogDto } from './dto/usage-log.dto';

@Injectable()
export class UsageLogsService {
  constructor(private prisma: PrismaService) {}

  private async assertChildOwnership(parentId: string, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException('Child not found');
    if (child.parentId !== parentId) throw new ForbiddenException('Not your child');
  }

  private async assertDeviceOwnership(parentId: string, deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');
  }

  async createLog(dto: CreateUsageLogDto) {
    return this.prisma.usageLog.create({
      data: {
        deviceId: dto.deviceId,
        childId: dto.childId,
        appName: dto.appName,
        category: dto.category,
        durationSec: dto.durationSeconds,
      },
    });
  }

  async getDailyUsage(parentId: string, childId: string, date?: Date) {
    await this.assertChildOwnership(parentId, childId);
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await this.prisma.usageLog.findMany({
      where: {
        childId,
        loggedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const totalSeconds = logs.reduce((sum: number, log) => sum + log.durationSec, 0);
    const byApp: Record<string, number> = {};
    for (const log of logs) {
      const key = log.appName || 'unknown';
      byApp[key] = (byApp[key] || 0) + log.durationSec;
    }

    return {
      childId,
      date: startOfDay.toISOString().split('T')[0],
      totalMinutes: Math.floor(totalSeconds / 60),
      totalSeconds,
      byApp,
      logCount: logs.length,
    };
  }

  async getWeeklyUsage(parentId: string, childId: string) {
    await this.assertChildOwnership(parentId, childId);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const logs = await this.prisma.usageLog.findMany({
      where: {
        childId,
        loggedAt: { gte: startOfWeek },
      },
      orderBy: { loggedAt: 'asc' },
    });

    const totalSeconds = logs.reduce((sum: number, log) => sum + log.durationSec, 0);
    const byDay: Record<string, number> = {};
    for (const log of logs) {
      const day = new Date(log.loggedAt).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + log.durationSec;
    }

    return {
      childId,
      weekStart: startOfWeek.toISOString().split('T')[0],
      totalMinutes: Math.floor(totalSeconds / 60),
      totalSeconds,
      byDay,
      logCount: logs.length,
    };
  }

  async getDeviceUsage(parentId: string, deviceId: string) {
    await this.assertDeviceOwnership(parentId, deviceId);
    const logs = await this.prisma.usageLog.findMany({
      where: { deviceId },
      orderBy: { loggedAt: 'desc' },
      take: 100,
    });

    const totalSeconds = logs.reduce((sum: number, log) => sum + log.durationSec, 0);
    return {
      deviceId,
      totalMinutes: Math.floor(totalSeconds / 60),
      totalSeconds,
      recentLogs: logs,
    };
  }

  async getActiveApp(childId: string) {
    const recentLog = await this.prisma.usageLog.findFirst({
      where: { childId },
      orderBy: { loggedAt: 'desc' },
    });
    return recentLog?.appName || null;
  }
}
