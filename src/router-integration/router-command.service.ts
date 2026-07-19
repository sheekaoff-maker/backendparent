import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { RouterCommandType } from '@prisma/client';

/**
 * Durable, retryable router-action queue for gateway-agent — the same
 * PENDING/DELIVERED/ACKNOWLEDGED/FAILED lifecycle as the existing `Command`
 * model (see ChildAgentService), scoped to a gateway instead of a device.
 *
 * IMPORTANT: `getPendingCommands` deliberately queries PENDING rows FIRST
 * and only marks THOSE specific IDs as DELIVERED afterwards. The existing
 * ChildAgentService.getCommands() marks-delivered-then-queries-PENDING,
 * which always returns an empty list — do not repeat that bug here.
 */
@Injectable()
export class RouterCommandService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async enqueueCommand(gatewayId: string, type: RouterCommandType, payload?: unknown, deviceId?: string) {
    return this.prisma.routerCommand.create({
      data: {
        gatewayId,
        deviceId: deviceId ?? null,
        type,
        payload: payload !== undefined ? JSON.stringify(payload) : null,
        status: 'PENDING',
      },
    });
  }

  async getPendingCommands(gatewayId: string) {
    const pending = await this.prisma.routerCommand.findMany({
      where: { gatewayId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) return [];

    const now = new Date();
    await this.prisma.routerCommand.updateMany({
      where: { id: { in: pending.map((c) => c.id) } },
      data: { status: 'DELIVERED', deliveredAt: now },
    });

    return pending.map((c) => ({ ...c, status: 'DELIVERED' as const, deliveredAt: now }));
  }

  async acknowledgeCommand(gatewayId: string, commandId: string, success: boolean, resultData?: unknown) {
    const command = await this.prisma.routerCommand.findUnique({ where: { id: commandId } });
    if (!command) throw new NotFoundException('Router command not found');
    if (command.gatewayId !== gatewayId) throw new ForbiddenException('Not your command');

    return this.prisma.routerCommand.update({
      where: { id: commandId },
      data: {
        status: success ? 'ACKNOWLEDGED' : 'FAILED',
        ackedAt: new Date(),
        resultData: resultData !== undefined ? JSON.stringify(resultData) : null,
      },
    });
  }

  async listRecentCommands(gatewayId: string, take = 20) {
    return this.prisma.routerCommand.findMany({
      where: { gatewayId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Everything gateway-agent needs to actually talk to the router: which
   * plugin to load and its decrypted admin credentials. Decryption happens
   * here, server-side, only for the authenticated gateway that owns the
   * row — the ciphertext never leaves the database otherwise, and the
   * decrypted value is never logged.
   */
  async getRouterConnectionInfo(gatewayId: string) {
    const router = await this.prisma.detectedRouter.findUnique({ where: { gatewayId } });
    if (!router) return null;

    let credentials: Record<string, unknown> | null = null;
    if (router.adminCredentialsEncrypted) {
      try {
        credentials = JSON.parse(this.encryption.decrypt(router.adminCredentialsEncrypted));
      } catch {
        credentials = null;
      }
    }

    return {
      pluginId: router.pluginId,
      ipAddress: router.ipAddress,
      hostname: router.hostname,
      credentials,
    };
  }
}
