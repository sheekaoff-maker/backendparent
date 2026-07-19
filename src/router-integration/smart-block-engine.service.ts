import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CapabilityEngineService } from './capability-engine.service';
import { RouterCommandService } from './router-command.service';
import { RouterCommandType } from '@prisma/client';

/**
 * Priority order per the Router Integration Engine spec: Disconnect Client
 * -> Pause Device -> Firewall Rule -> MAC Filter -> DNS Block. ACL and
 * "Parental Control API" are folded into Firewall Rule for the vendors this
 * pass supports — none of them expose a separate ACL primitive distinct
 * from a firewall rule. Only capabilities the detected router actually
 * supports are included; an undetected or Guide-Only router yields an
 * empty (never-fabricated) strategy list.
 */
const STRATEGY_PRIORITY: Array<{ type: RouterCommandType; flag: 'supportsClientDisconnect' | 'supportsPauseDevice' | 'supportsFirewallRules' | 'supportsMACFiltering' | 'supportsDNSChange' }> = [
  { type: 'DISCONNECT_CLIENT', flag: 'supportsClientDisconnect' },
  { type: 'PAUSE_DEVICE', flag: 'supportsPauseDevice' },
  { type: 'APPLY_FIREWALL_RULE', flag: 'supportsFirewallRules' },
  { type: 'BLOCK_MAC', flag: 'supportsMACFiltering' },
  { type: 'CHANGE_DNS', flag: 'supportsDNSChange' },
];

@Injectable()
export class SmartBlockEngineService {
  constructor(
    private prisma: PrismaService,
    private capabilityEngine: CapabilityEngineService,
    private routerCommandService: RouterCommandService,
  ) {}

  async endGamingSession(parentId: string, gatewayId: string, deviceId: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');

    const router = await this.prisma.detectedRouter.findUnique({ where: { gatewayId } });
    const pluginId = router?.pluginId ?? null;

    const strategies = STRATEGY_PRIORITY.filter(({ flag }) => this.capabilityEngine.isSupported(pluginId, flag)).map(
      ({ type }) => type,
    );

    if (strategies.length === 0) {
      return {
        enqueued: false,
        commandId: null,
        strategies: [],
        reason: router?.pluginId
          ? 'This router has no supported control strategy (Guide Only) — see Supported Features for manual instructions.'
          : 'No router has been detected on this gateway yet.',
      };
    }

    const command = await this.routerCommandService.enqueueCommand(
      gatewayId,
      'END_GAMING_SESSION',
      { deviceId, strategies },
      deviceId,
    );

    return { enqueued: true, commandId: command.id, strategies, reason: null };
  }
}
