import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    deviceId?: string;
    childId?: string;
    sessionId?: string;
  }) {
    const notification = await this.prisma.notificationEvent.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        deviceId: data.deviceId,
        childId: data.childId,
        sessionId: data.sessionId,
      },
    });

    await this.sendViaFcm(notification.id, data.userId, data.title, data.message);

    return notification;
  }

  async findByUser(userId: string) {
    return this.prisma.notificationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string) {
    return this.prisma.notificationEvent.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  private async sendViaFcm(notificationId: string, userId: string, title: string, message: string) {
    const fcmKey = process.env.FCM_SERVER_KEY;
    if (!fcmKey) {
      this.logger.warn(`FCM_SERVER_KEY not set. Notification ${notificationId} stored but not pushed.`);
      return;
    }
    this.logger.log(`[FCM Placeholder] Would send to user ${userId}: ${title} - ${message}`);
  }
}
