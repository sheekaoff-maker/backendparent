import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RulesService } from '../rules/rules.service';
import { UsageLogsService } from '../usage-logs/usage-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RegisterDeviceDto,
  CommandAckDto,
  UsageLogFromAgentDto,
  RequestMoreTimeDto,
  ChildStatusDto,
} from './dto/child-agent.dto';
import { ControlMethod, CommandType } from '@prisma/client';

@Injectable()
export class ChildAgentService {
  constructor(
    private prisma: PrismaService,
    private rulesService: RulesService,
    private usageLogsService: UsageLogsService,
    private notificationsService: NotificationsService,
  ) {}

  async registerDevice(parentId: string, dto: RegisterDeviceDto) {
    const controlMethod = this.inferControlMethod(dto.deviceType);
    return this.prisma.device.create({
      data: {
        parentId,
        childId: dto.childId,
        name: dto.deviceName,
        type: dto.deviceType,
        platform: dto.platform,
        macAddress: dto.macAddress,
        controlMethod,
        status: 'ONLINE',
        lastSeen: new Date(),
      },
    });
  }

  async getRules(childId: string) {
    return this.rulesService.getActiveRulesForChild(childId);
  }

  async getCommands(deviceId: string) {
    await this.markCommandsDelivered(deviceId);
    return this.prisma.command.findMany({
      where: { deviceId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }

  async acknowledgeCommand(dto: CommandAckDto) {
    const command = await this.prisma.command.findUnique({ where: { id: dto.commandId } });
    if (!command) throw new NotFoundException('Command not found');

    await this.prisma.command.update({
      where: { id: dto.commandId },
      data: { status: dto.success ? 'ACKNOWLEDGED' : 'FAILED', ackedAt: new Date() },
    });

    return this.prisma.commandAck.create({
      data: {
        commandId: dto.commandId,
        success: dto.success,
        resultData: dto.resultData,
      },
    });
  }

  async reportUsage(dto: UsageLogFromAgentDto) {
    await this.prisma.device.update({
      where: { id: dto.deviceId },
      data: { lastSeen: new Date() },
    });
    return this.usageLogsService.createLog(dto);
  }

  async requestMoreTime(dto: RequestMoreTimeDto) {
    const session = await this.prisma.session.findUnique({ where: { id: dto.sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    await this.notificationsService.create({
      userId: session.parentId,
      type: 'CHILD_REQUEST_MORE_TIME',
      title: 'Time Extension Request',
      message: `Child requests ${dto.requestedMinutes} more minutes`,
      sessionId: session.id,
      childId: session.childId,
      deviceId: session.deviceId,
    });

    return { success: true, message: 'Request sent to parent' };
  }

  async reportStatus(dto: ChildStatusDto) {
    await this.prisma.device.update({
      where: { id: dto.deviceId },
      data: { lastSeen: new Date() },
    });

    if (dto.activeApp) {
      const device = await this.prisma.device.findUnique({ where: { id: dto.deviceId } });
      if (device?.childId) {
        const activeSession = await this.prisma.session.findFirst({
          where: { deviceId: dto.deviceId, status: 'ACTIVE' },
        });
        if (activeSession) {
          await this.prisma.session.update({
            where: { id: activeSession.id },
            data: { activeApp: dto.activeApp },
          });
        }
      }
    }

    return { success: true };
  }

  private inferControlMethod(deviceType: string): ControlMethod {
    switch (deviceType) {
      case 'ANDROID_PHONE':
      case 'ANDROID_TABLET':
        return ControlMethod.ANDROID_AGENT;
      case 'IPHONE':
      case 'IPAD':
        return ControlMethod.IOS_SCREEN_TIME;
      case 'XBOX':
        return ControlMethod.XBOX_ADAPTER;
      case 'PLAYSTATION':
      case 'SMART_TV':
      case 'STREAMING_BOX':
        return ControlMethod.NETWORK_GATEWAY;
      default:
        return ControlMethod.MOCK;
    }
  }

  private async markCommandsDelivered(deviceId: string) {
    await this.prisma.command.updateMany({
      where: { deviceId, status: 'PENDING' },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
  }
}
