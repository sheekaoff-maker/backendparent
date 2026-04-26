import { Device, ControlMethod, DeviceType } from '@prisma/client';

export interface ControlResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface AdapterDeviceStatus {
  online: boolean;
  blocked: boolean;
  activeApp?: string;
  lastSeen?: Date;
}

export interface ControlAdapter {
  startSession(device: Device, rule?: unknown): Promise<ControlResult>;
  stopSession(device: Device): Promise<ControlResult>;
  blockDevice(device: Device, reason: string): Promise<ControlResult>;
  unblockDevice(device: Device): Promise<ControlResult>;
  extendSession(device: Device, minutes: number): Promise<ControlResult>;
  getStatus(device: Device): Promise<AdapterDeviceStatus>;
}

export function getAdapterForDevice(device: Device): ControlMethod {
  switch (device.type) {
    case DeviceType.ANDROID_PHONE:
    case DeviceType.ANDROID_TABLET:
      return ControlMethod.ANDROID_AGENT;
    case DeviceType.IPHONE:
    case DeviceType.IPAD:
      return ControlMethod.IOS_SCREEN_TIME;
    case DeviceType.XBOX:
      return ControlMethod.XBOX_ADAPTER;
    case DeviceType.PLAYSTATION:
    case DeviceType.SMART_TV:
    case DeviceType.STREAMING_BOX:
    case DeviceType.OTHER:
      return ControlMethod.NETWORK_GATEWAY;
    default:
      return ControlMethod.MOCK;
  }
}

export function isOfflineGameUnsupported(device: Device): boolean {
  return (
    device.type === DeviceType.PLAYSTATION ||
    device.type === DeviceType.SMART_TV ||
    device.type === DeviceType.STREAMING_BOX ||
    device.type === DeviceType.OTHER
  );
}
