import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FcmMessage, FcmSender } from './fcm.sender';
import { PushPlatform } from './dto/push-token.dto';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmSender,
  ) {}

  /** Whether real push delivery is wired (service account present). */
  get deliveryEnabled(): boolean {
    return this.fcm.isConfigured;
  }

  async registerToken(userId: string, token: string, platform: PushPlatform) {
    // A token is globally unique but may migrate between users (shared device,
    // account switch). Upsert re-points it at the current user.
    return this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, lastUsedAt: new Date() },
      create: { userId, token, platform },
    });
  }

  async removeToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  /**
   * Fan a notification out to all of a user's registered devices. Stale tokens
   * (UNREGISTERED / 404) are pruned so the table self-heals. Never throws — a
   * push failure must not break the action that triggered the notification.
   */
  async sendToUser(userId: string, message: FcmMessage): Promise<void> {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return;

    const invalid: string[] = [];
    await Promise.all(
      tokens.map(async ({ token }) => {
        const result = await this.fcm.send(token, message);
        if (result === 'invalid') invalid.push(token);
      }),
    );

    if (invalid.length > 0) {
      await this.prisma.pushToken
        .deleteMany({ where: { token: { in: invalid } } })
        .catch((err) =>
          this.logger.warn(`Failed pruning ${invalid.length} stale tokens: ${err}`),
        );
    }
  }
}
