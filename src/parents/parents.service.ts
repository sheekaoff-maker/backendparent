import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ParentsService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        subscription: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'ACCOUNT_DELETION_CONFIRMED',
          entity: 'user',
          entityId: user.id,
          details: JSON.stringify({
            email: user.email,
            source: 'in_app',
          }),
        },
      }),
      this.prisma.user.delete({
        where: { id: user.id },
      }),
    ]);
  }

  async submitPrivacyRequest(data: {
    email: string;
    requestType?: 'delete_account' | 'privacy_question';
    message?: string;
    ipAddress?: string;
  }) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const requestType = data.requestType || 'delete_account';
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      select: { id: true, email: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: existingUser?.id,
        action:
          requestType === 'delete_account'
            ? 'ACCOUNT_DELETION_WEB_REQUEST'
            : 'PRIVACY_WEB_REQUEST',
        entity: 'legal_request',
        entityId: existingUser?.id || normalizedEmail,
        details: JSON.stringify({
          email: existingUser?.email || normalizedEmail,
          requestType,
          message: data.message?.trim() || null,
          source: 'public_web_form',
        }),
        ipAddress: data.ipAddress,
      },
    });
  }

  async getSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }
}
