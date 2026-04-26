import { Injectable } from '@nestjs/common';
import { ControlAdapter, ControlResult, AdapterDeviceStatus } from './control-adapter.interface';
import { Device } from '@prisma/client';

@Injectable()
export class MockAdapter implements ControlAdapter {
  async startSession(device: Device, rule?: unknown): Promise<ControlResult> {
    return { success: true, message: `[MOCK] Session started for device ${device.id}` };
  }

  async stopSession(device: Device): Promise<ControlResult> {
    return { success: true, message: `[MOCK] Session stopped for device ${device.id}` };
  }

  async blockDevice(device: Device, reason: string): Promise<ControlResult> {
    return { success: true, message: `[MOCK] Device ${device.id} blocked: ${reason}` };
  }

  async unblockDevice(device: Device): Promise<ControlResult> {
    return { success: true, message: `[MOCK] Device ${device.id} unblocked` };
  }

  async extendSession(device: Device, minutes: number): Promise<ControlResult> {
    return { success: true, message: `[MOCK] Device ${device.id} session extended ${minutes}min` };
  }

  async getStatus(device: Device): Promise<AdapterDeviceStatus> {
    return { online: true, blocked: false };
  }
}
