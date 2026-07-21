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
type StrategyFlag = 'supportsClientDisconnect' | 'supportsPauseDevice' | 'supportsFirewallRules' | 'supportsMACFiltering' | 'supportsDNSChange';

const STRATEGY_PRIORITY: Array<{ type: RouterCommandType; flag: StrategyFlag }> = [
  { type: 'DISCONNECT_CLIENT', flag: 'supportsClientDisconnect' },
  { type: 'PAUSE_DEVICE', flag: 'supportsPauseDevice' },
  { type: 'APPLY_FIREWALL_RULE', flag: 'supportsFirewallRules' },
  { type: 'BLOCK_MAC', flag: 'supportsMACFiltering' },
  { type: 'CHANGE_DNS', flag: 'supportsDNSChange' },
];

// Deliberately narrower than STRATEGY_PRIORITY above: excludes
// DISCONNECT_CLIENT (transient — a kicked-off client can simply
// reconnect, defeating a *persistent* block) and CHANGE_DNS (this command
// changes the router's own upstream resolver, i.e. router-wide, not
// scoped to one device — using it to "block one device" would incorrectly
// affect every device on that router). Only strategies that genuinely
// target a single device/MAC/IP belong in a persistent per-device block.
const BLOCK_STRATEGY_PRIORITY: Array<{ type: RouterCommandType; flag: StrategyFlag }> = [
  { type: 'PAUSE_DEVICE', flag: 'supportsPauseDevice' },
  { type: 'APPLY_FIREWALL_RULE', flag: 'supportsFirewallRules' },
  { type: 'BLOCK_MAC', flag: 'supportsMACFiltering' },
];

@Injectable()
export class SmartBlockEngineService {
  constructor(
    private prisma: PrismaService,
    private capabilityEngine: CapabilityEngineService,
    private routerCommandService: RouterCommandService,
  ) {}

  private buildStrategies(pluginId: string | null, priority: Array<{ type: RouterCommandType; flag: StrategyFlag }>): RouterCommandType[] {
    return priority.filter(({ flag }) => this.capabilityEngine.isSupported(pluginId, flag)).map(({ type }) => type);
  }

  private async enqueueStrategyCommand(
    gatewayId: string,
    deviceId: string,
    commandType: RouterCommandType,
    priority: Array<{ type: RouterCommandType; flag: StrategyFlag }>,
  ) {
    const router = await this.prisma.detectedRouter.findUnique({ where: { gatewayId } });
    const pluginId = router?.pluginId ?? null;
    const strategies = this.buildStrategies(pluginId, priority);

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

    const command = await this.routerCommandService.enqueueCommand(gatewayId, commandType, { deviceId, strategies }, deviceId);
    return { enqueued: true, commandId: command.id, strategies, reason: null };
  }

  async endGamingSession(parentId: string, gatewayId: string, deviceId: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');

    return this.enqueueStrategyCommand(gatewayId, deviceId, 'END_GAMING_SESSION', STRATEGY_PRIORITY);
  }

  /**
   * Internal, service-to-service entry points (no parentId/ownership check
   * here — callers like EnforcementService have already authorized the
   * request against the device, including system-initiated blocks with no
   * parentId at all, e.g. an offline time-limit violation). Enqueues an
   * explicit router command alongside the existing poll-based
   * NetworkGatewayAdapter path so a manual block/unblock converges faster
   * than waiting for the next gateway-agent policy poll.
   */
  async syncBlockToRouter(gatewayId: string, deviceId: string) {
    return this.enqueueStrategyCommand(gatewayId, deviceId, 'BLOCK_DEVICE', BLOCK_STRATEGY_PRIORITY);
  }

  async syncUnblockToRouter(gatewayId: string, deviceId: string) {
    return this.enqueueStrategyCommand(gatewayId, deviceId, 'UNBLOCK_DEVICE', BLOCK_STRATEGY_PRIORITY);
  }
}
