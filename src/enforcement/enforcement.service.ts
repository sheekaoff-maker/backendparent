import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ControlAdapter, ControlResult, getAdapterForDevice, isOfflineGameUnsupported } from './adapters/control-adapter.interface';
import { AndroidAgentAdapter } from './adapters/android-agent.adapter';
import { IosScreenTimeAdapter } from './adapters/ios-screen-time.adapter';
import { XboxAdapter } from './adapters/xbox.adapter';
import { NetworkGatewayAdapter } from './adapters/network-gateway.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { Device, ControlMethod } from '@prisma/client';
import { DnsPolicyService } from '../dns-policy/dns-policy.service';
import { AuditService } from '../audit/audit.service';
import { SmartBlockEngineService } from '../router-integration/smart-block-engine.service';

@Injectable()
export class EnforcementService {
  private readonly adapters: Map<ControlMethod, ControlAdapter>;
  private readonly logger = new Logger(EnforcementService.name);

  constructor(
    private prisma: PrismaService,
    private androidAdapter: AndroidAgentAdapter,
    private iosAdapter: IosScreenTimeAdapter,
    private xboxAdapter: XboxAdapter,
    private networkGatewayAdapter: NetworkGatewayAdapter,
    private mockAdapter: MockAdapter,
    private dnsPolicyService: DnsPolicyService,
    private audit: AuditService,
    private smartBlockEngine: SmartBlockEngineService,
  ) {
    this.adapters = new Map<ControlMethod, ControlAdapter>([
      [ControlMethod.ANDROID_AGENT, androidAdapter],
      [ControlMethod.IOS_SCREEN_TIME, iosAdapter],
      [ControlMethod.XBOX_ADAPTER, xboxAdapter],
      [ControlMethod.NETWORK_GATEWAY, networkGatewayAdapter],
      [ControlMethod.MOCK, mockAdapter],
    ]);
  }

  getAdapter(device: Device): ControlAdapter {
    const method = device.controlMethod;
    const adapter = this.adapters.get(method);
    if (!adapter) {
      return this.mockAdapter;
    }
    return adapter;
  }

  getAdapterByMethod(method: ControlMethod): ControlAdapter {
    return this.adapters.get(method) || this.mockAdapter;
  }

  async blockDevice(deviceId: string, reason: string, parentId?: string): Promise<ControlResult> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    if (parentId && device.parentId !== parentId) throw new ForbiddenException('Not your device');
    const adapter = this.getAdapter(device);
    const result = await adapter.blockDevice(device, reason);
    if (result.success) {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { status: 'BLOCKED' },
      });
      await this.invalidateDnsCache(device);
      await this.audit.log({
        userId: parentId,
        action: 'device.block',
        entity: 'device',
        entityId: deviceId,
        details: reason,
      });
      const routerSync = await this.syncToRouter(device, 'block');
      return { ...result, data: { ...result.data, routerSync } };
    }
    return result;
  }

  async unblockDevice(deviceId: string, parentId?: string): Promise<ControlResult> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    if (parentId && device.parentId !== parentId) throw new ForbiddenException('Not your device');
    const adapter = this.getAdapter(device);
    const result = await adapter.unblockDevice(device);
    if (result.success) {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { status: 'ONLINE' },
      });
      await this.invalidateDnsCache(device);
      await this.audit.log({
        userId: parentId,
        action: 'device.unblock',
        entity: 'device',
        entityId: deviceId,
      });
      const routerSync = await this.syncToRouter(device, 'unblock');
      return { ...result, data: { ...result.data, routerSync } };
    }
    return result;
  }

  /**
   * Explicit, immediate router-command convergence path for a block/unblock,
   * on top of (not instead of) the existing gateway-agent policy poll cycle
   * — closes the "up to one full poll interval to actually take effect at
   * the router" gap. Best-effort: a device with no gatewayId (not behind a
   * managed router) or a router sync failure never fails the overall
   * block/unblock call, since the adapter-driven result above already
   * succeeded and is the primary enforcement path; this is a confirmation
   * of whether the faster path was also available, returned to the caller
   * rather than swallowed silently.
   */
  private async syncToRouter(
    device: Device,
    action: 'block' | 'unblock',
  ): Promise<{ attempted: boolean; enqueued: boolean; commandId: string | null; strategies: string[]; reason: string | null }> {
    if (!device.gatewayId) {
      return { attempted: false, enqueued: false, commandId: null, strategies: [], reason: 'device has no gateway' };
    }

    try {
      const outcome =
        action === 'block'
          ? await this.smartBlockEngine.syncBlockToRouter(device.gatewayId, device.id)
          : await this.smartBlockEngine.syncUnblockToRouter(device.gatewayId, device.id);
      return { attempted: true, ...outcome };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Router ${action} sync failed for device ${device.id}: ${message}`);
      return { attempted: true, enqueued: false, commandId: null, strategies: [], reason: message };
    }
  }

  /**
   * This path (block/unblock via a ControlAdapter — used for every
   * NETWORK_GATEWAY device, i.e. every console/TV/streaming box this audit
   * is actually about) only wrote device.status, never invalidated the
   * DNS-policy cache the way devices.service.ts's lockInternet/unlockInternet
   * already did — so a cached ALLOW decision (up to 30s TTL) could keep
   * resolving DNS for a device the parent had just blocked. Same fix,
   * applied here too.
   */
  private async invalidateDnsCache(device: { ipAddress: string | null; dnsSourceIp: string | null; ipv6Address: string | null }) {
    await this.dnsPolicyService.invalidateSourceIps([device.ipAddress, device.dnsSourceIp, device.ipv6Address]);
  }

  async syncRules(deviceId: string, parentId?: string): Promise<ControlResult> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    if (parentId && device.parentId !== parentId) throw new ForbiddenException('Not your device');
    if (!device.childId) return { success: false, message: 'Device not assigned to child' };

    const rules = await this.prisma.rule.findMany({
      where: { childId: device.childId, active: true },
    });

    const adapter = this.getAdapter(device);
    return adapter.startSession(device, rules);
  }

  async handleOfflineViolation(device: Device, sessionId: string): Promise<ControlResult> {
    const adapter = this.getAdapter(device);

    await adapter.stopSession(device);

    if (isOfflineGameUnsupported(device)) {
      if (device.gatewayId) {
        // Routed through this.blockDevice() (not adapter.blockDevice()
        // directly) so a time-limit/offline-violation block gets the same
        // device.status write + DNS-cache invalidation as a manual block —
        // this path previously skipped both.
        await this.blockDevice(device.id, 'Session expired - offline game violation');
      }

      return {
        success: true,
        message: 'Session expired, internet blocked via gateway. Cannot kill offline game directly. Parent notified.',
        data: {
          offlineLimitation: true,
          actions: [
            'expire_session',
            'block_internet_via_gateway',
            'prevent_future_online_access',
            'apply_cooldown',
            'notify_parent',
            'mark_session_violated',
          ],
        },
      };
    }

    return this.blockDevice(device.id, 'Session expired');
  }
}
