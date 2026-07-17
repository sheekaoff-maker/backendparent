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

  /** Whether real push delivery is wired (Firebase initialized). */
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
   * Fan a notification out to all of a user's registered devices via a single
   * multicast call. Stale tokens (UNREGISTERED / invalid) are pruned so the
   * table self-heals; transient failures are retried inside FcmSender. Never
   * throws — a push failure must not break the action that triggered it.
   */
  async sendToUser(userId: string, message: FcmMessage): Promise<void> {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return; // offline / no registered device — nothing to do

    const result = await this.fcm.sendMulticast(
      tokens.map((t) => t.token),
      message,
    );

    if (result.invalid.length > 0) {
      await this.prisma.pushToken
        .deleteMany({ where: { token: { in: result.invalid } } })
        .catch((err) =>
          this.logger.warn(`Failed pruning ${result.invalid.length} stale tokens: ${err}`),
        );
    }
    if (result.errored.length > 0) {
      this.logger.warn(
        `FCM delivery failed for ${result.errored.length}/${tokens.length} token(s) for user ${userId}`,
      );
    }
  }
}
