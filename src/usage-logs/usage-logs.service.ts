import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateUsageLogDto } from './dto/usage-log.dto';

@Injectable()
export class UsageLogsService {
  constructor(private prisma: PrismaService) {}

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

  async getDailyUsage(childId: string, date?: Date) {
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

  async getWeeklyUsage(childId: string) {
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

  async getDeviceUsage(deviceId: string) {
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
