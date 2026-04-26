import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { getPlatformSupport } from '../platform-support/platform-support.matrix';
import { ChecklistDto, SetSetupStatusDto } from './dto/offline-control.dto';
import { getOfflineGuide } from './offline-guides.data';

@Injectable()
export class OfflineControlService {
  constructor(private prisma: PrismaService) {}

  getGuide(deviceType: DeviceType) {
    const guide = getOfflineGuide(deviceType);
    if (!guide) {
      throw new NotFoundException(
        `No offline-control guide for ${deviceType}. Supported: XBOX, PLAYSTATION, NINTENDO, STEAM_DECK, SMART_TV, PC.`,
      );
    }
    return guide;
  }

  /**
   * Mark setup status. Honest: we cannot actually verify the parent did the setup,
   * we only record what they tell us so the UI can stop nagging.
   */
  async setSetupStatus(parentId: string, deviceId: string, dto: SetSetupStatusDto) {
    const device = await this.assertOwned(parentId, deviceId);
    return this.prisma.device.update({
      where: { id: deviceId },
      data: {
        offlineControlEnabled: dto.completed,
        offlineSetupCompletedAt: dto.completed ? new Date() : null,
        offlineSetupVerified: dto.verified ?? device.offlineSetupVerified,
        offlineControlMethod: dto.method ?? device.offlineControlMethod,
        offlineControlNotes: dto.notes ?? device.offlineControlNotes,
      },
    });
  }

  async getStatus(parentId: string, deviceId: string) {
    const device = await this.assertOwned(parentId, deviceId);
    const support = getPlatformSupport(device.type);
    const checklist = await this.prisma.offlineControlChecklist.findUnique({
      where: { deviceId },
    });

    const completedCount = checklist
      ? Object.values({
          pinEnabled: checklist.pinEnabled,
          childAccountLinked: checklist.childAccountLinked,
          playTimeLimitEnabled: checklist.playTimeLimitEnabled,
          ageRatingEnabled: checklist.ageRatingEnabled,
          purchasesBlocked: checklist.purchasesBlocked,
          networkSettingsLocked: checklist.networkSettingsLocked,
        }).filter(Boolean).length
      : 0;

    const setupRequired = !device.offlineControlEnabled || completedCount < 4;

    return {
      deviceId: device.id,
      deviceType: device.type,
      onlineControlSupported: support.onlineControl,
      offlineControlSupported: support.offlineControlSupported,
      offlineControlMethod: device.offlineControlMethod ?? support.offlineControlMethod,
      offlineControlEnabled: device.offlineControlEnabled,
      offlineSetupCompletedAt: device.offlineSetupCompletedAt,
      offlineSetupVerified: device.offlineSetupVerified,
      protectionStatus: device.protectionStatus,
      checklist: checklist ?? null,
      checklistCompletedCount: completedCount,
      setupRequired,
      limitations: getOfflineGuide(device.type)?.limitations ?? [
        'Backend cannot directly kill offline games on this device.',
      ],
      recommendedNextStep: this.recommendNextStep(device, checklist, setupRequired),
    };
  }

  async upsertChecklist(parentId: string, deviceId: string, dto: ChecklistDto) {
    await this.assertOwned(parentId, deviceId);
    const data: any = {};
    for (const k of [
      'pinEnabled',
      'childAccountLinked',
      'playTimeLimitEnabled',
      'ageRatingEnabled',
      'purchasesBlocked',
      'networkSettingsLocked',
      'notes',
    ]) {
      if ((dto as any)[k] !== undefined) data[k] = (dto as any)[k];
    }
    return this.prisma.offlineControlChecklist.upsert({
      where: { deviceId },
      create: { deviceId, ...data },
      update: data,
    });
  }

  private async assertOwned(parentId: string, deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('Not your device');
    return device;
  }

  private recommendNextStep(
    device: { type: DeviceType; offlineControlEnabled: boolean; offlineSetupVerified: boolean },
    checklist: any,
    setupRequired: boolean,
  ) {
    if (!device.offlineControlEnabled) {
      return `Open the ${device.type} setup guide and follow the official vendor steps.`;
    }
    if (!checklist?.pinEnabled) return 'Enable a PIN on the device to prevent settings changes.';
    if (!checklist?.childAccountLinked) return 'Link the child account to the family.';
    if (!checklist?.playTimeLimitEnabled) return 'Configure daily play-time limit in the vendor app.';
    if (!checklist?.ageRatingEnabled) return 'Set age-rating restrictions for games.';
    if (!checklist?.purchasesBlocked) return 'Block in-store purchases (ask-to-buy).';
    if (!checklist?.networkSettingsLocked) return 'Lock network settings so the child cannot change DNS.';
    if (!device.offlineSetupVerified) return 'Mark setup as verified once you tested it works.';
    if (setupRequired) return 'Continue checklist items.';
    return 'All offline-control items complete. Online traffic is filtered by our DNS.';
  }
}
