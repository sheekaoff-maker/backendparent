import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ControlAdapter, ControlResult, getAdapterForDevice, isOfflineGameUnsupported } from './adapters/control-adapter.interface';
import { AndroidAgentAdapter } from './adapters/android-agent.adapter';
import { IosScreenTimeAdapter } from './adapters/ios-screen-time.adapter';
import { XboxAdapter } from './adapters/xbox.adapter';
import { NetworkGatewayAdapter } from './adapters/network-gateway.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { Device, ControlMethod } from '@prisma/client';

@Injectable()
export class EnforcementService {
  private readonly adapters: Map<ControlMethod, ControlAdapter>;

  constructor(
    private prisma: PrismaService,
    private androidAdapter: AndroidAgentAdapter,
    private iosAdapter: IosScreenTimeAdapter,
    private xboxAdapter: XboxAdapter,
    private networkGatewayAdapter: NetworkGatewayAdapter,
    private mockAdapter: MockAdapter,
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

  async blockDevice(deviceId: string, reason: string): Promise<ControlResult> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    const adapter = this.getAdapter(device);
    const result = await adapter.blockDevice(device, reason);
    if (result.success) {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { status: 'BLOCKED' },
      });
    }
    return result;
  }

  async unblockDevice(deviceId: string): Promise<ControlResult> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    const adapter = this.getAdapter(device);
    const result = await adapter.unblockDevice(device);
    if (result.success) {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { status: 'ONLINE' },
      });
    }
    return result;
  }

  async syncRules(deviceId: string): Promise<ControlResult> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
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
        await adapter.blockDevice(device, 'Session expired - offline game violation');
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

    return adapter.blockDevice(device, 'Session expired');
  }
}
