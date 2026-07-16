import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificationType } from '@prisma/client';
import { PushService } from '../push/push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

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

    // Fan out to the user's devices. Delivery is best-effort and never blocks
    // or fails the triggering action; the row is already persisted for the
    // in-app notification center regardless of push outcome.
    const delivered = await this.deliver(notification.id, data);

    if (delivered) {
      await this.prisma.notificationEvent
        .update({ where: { id: notification.id }, data: { sentViaFcm: true } })
        .catch(() => undefined);
    }

    return notification;
  }

  private async deliver(
    notificationId: string,
    data: {
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      deviceId?: string;
      childId?: string;
      sessionId?: string;
    },
  ): Promise<boolean> {
    if (!this.push.deliveryEnabled) return false;
    // Deep-link payload consumed by the mobile app's notification handler.
    const payload: Record<string, string> = {
      notificationId,
      type: data.type,
    };
    if (data.deviceId) payload.deviceId = data.deviceId;
    if (data.childId) payload.childId = data.childId;
    if (data.sessionId) payload.sessionId = data.sessionId;
    try {
      await this.push.sendToUser(data.userId, {
        title: data.title,
        body: data.message,
        data: payload,
      });
      return true;
    } catch {
      return false;
    }
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

  async markReadForUser(userId: string, notificationId: string) {
    const notification = await this.prisma.notificationEvent.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return this.markRead(notificationId);
  }
}
