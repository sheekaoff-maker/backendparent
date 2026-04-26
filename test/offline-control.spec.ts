import { Test } from '@nestjs/testing';
import { OfflineControlService } from '../src/offline-control/offline-control.service';
import { PrismaService } from '../src/common/prisma.service';
import { getOfflineGuide } from '../src/offline-control/offline-guides.data';

const mkDevice = (over: any = {}) => ({
  id: 'd1',
  parentId: 'p1',
  type: 'PLAYSTATION',
  offlineControlEnabled: false,
  offlineSetupCompletedAt: null,
  offlineSetupVerified: false,
  offlineControlMethod: null,
  offlineControlNotes: null,
  protectionStatus: 'NORMAL',
  ...over,
});

const mkPrisma = (device: any = mkDevice(), checklist: any = null) => ({
  device: {
    findUnique: jest.fn().mockResolvedValue(device),
    update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...device, ...data })),
  },
  offlineControlChecklist: {
    findUnique: jest.fn().mockResolvedValue(checklist),
    upsert: jest.fn().mockImplementation(({ create, update }: any) =>
      Promise.resolve({ deviceId: device.id, ...create, ...update }),
    ),
  },
});

async function build(prisma: any) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      OfflineControlService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return moduleRef.get(OfflineControlService);
}

describe('Offline guides — vendor honesty', () => {
  it.each(['XBOX', 'PLAYSTATION', 'NINTENDO', 'STEAM_DECK', 'PC', 'SMART_TV'])(
    '%s has a guide with steps + limitations',
    (deviceType) => {
      const g = getOfflineGuide(deviceType as any);
      expect(g).not.toBeNull();
      expect(g!.steps.length).toBeGreaterThan(0);
      expect(g!.limitations.length).toBeGreaterThan(0);
      expect(g!.officialUrl).toMatch(/^https?:\/\//);
    },
  );

  it('returns null for unsupported device type', () => {
    expect(getOfflineGuide('ANDROID_PHONE' as any)).toBeNull();
  });
});

describe('OfflineControlService.getStatus', () => {
  it('reports onlineControl=true, offlineControlSupported=false for PlayStation, setupRequired=true', async () => {
    const prisma = mkPrisma(mkDevice({ type: 'PLAYSTATION' }), null);
    const svc = await build(prisma);
    const s = await svc.getStatus('p1', 'd1');
    expect(s.onlineControlSupported).toBe(true);
    expect(s.offlineControlSupported).toBe(false);
    expect(s.setupRequired).toBe(true);
    expect(s.limitations.length).toBeGreaterThan(0);
    expect(s.recommendedNextStep).toMatch(/setup guide/i);
  });

  it('Xbox: offlineControlSupported=true', async () => {
    const prisma = mkPrisma(mkDevice({ type: 'XBOX' }), null);
    const svc = await build(prisma);
    const s = await svc.getStatus('p1', 'd1');
    expect(s.offlineControlSupported).toBe(true);
  });

  it('forbids access when device belongs to another parent', async () => {
    const prisma = mkPrisma(mkDevice({ parentId: 'someone' }));
    const svc = await build(prisma);
    await expect(svc.getStatus('p1', 'd1')).rejects.toThrow();
  });
});

describe('OfflineControlService.setSetupStatus & checklist', () => {
  it('marks setup completed sets offlineSetupCompletedAt', async () => {
    const prisma = mkPrisma();
    const svc = await build(prisma);
    await svc.setSetupStatus('p1', 'd1', { completed: true, method: 'SONY_PARENTAL_CONTROLS' });
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({
        offlineControlEnabled: true,
        offlineControlMethod: 'SONY_PARENTAL_CONTROLS',
      }),
    });
    const args = (prisma.device.update as jest.Mock).mock.calls[0][0];
    expect(args.data.offlineSetupCompletedAt).toBeInstanceOf(Date);
  });

  it('upserts checklist and only writes provided fields', async () => {
    const prisma = mkPrisma();
    const svc = await build(prisma);
    await svc.upsertChecklist('p1', 'd1', { pinEnabled: true, ageRatingEnabled: true });
    const upsertArgs = (prisma.offlineControlChecklist.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertArgs.update).toEqual({ pinEnabled: true, ageRatingEnabled: true });
    expect(upsertArgs.update).not.toHaveProperty('childAccountLinked');
  });

  it('recommendedNextStep advances as checklist fills up', async () => {
    const fullChecklist = {
      pinEnabled: true,
      childAccountLinked: true,
      playTimeLimitEnabled: true,
      ageRatingEnabled: true,
      purchasesBlocked: true,
      networkSettingsLocked: true,
    };
    const prisma = mkPrisma(
      mkDevice({ offlineControlEnabled: true, offlineSetupVerified: true, type: 'XBOX' }),
      fullChecklist,
    );
    const svc = await build(prisma);
    const s = await svc.getStatus('p1', 'd1');
    expect(s.checklistCompletedCount).toBe(6);
    expect(s.setupRequired).toBe(false);
    expect(s.recommendedNextStep).toMatch(/complete/i);
  });
});
