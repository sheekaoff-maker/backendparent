import { SessionsService } from '../src/sessions/sessions.service';
import { RulesService } from '../src/rules/rules.service';
import { PrismaService } from '../src/common/prisma.service';
import { SessionStatus } from '@prisma/client';

describe('SessionsService - calculateRemainingMinutes', () => {
  let sessionsService: SessionsService;

  beforeEach(() => {
    const prismaMock = {} as PrismaService;
    const rulesServiceMock = {
      getDailyLimit: jest.fn().mockResolvedValue(null),
      getActiveRulesForChild: jest.fn().mockResolvedValue([]),
    } as unknown as RulesService;
    sessionsService = new SessionsService(prismaMock, rulesServiceMock);
  });

  it('should return 0 for a stopped session', () => {
    const result = sessionsService.calculateRemainingMinutes({
      startedAt: new Date(),
      resumedAt: null,
      pausedAt: null,
      durationMinutes: 60,
      extendedMinutes: 0,
      status: SessionStatus.STOPPED,
    });
    expect(result).toBe(0);
  });

  it('should return 0 for an expired session', () => {
    const result = sessionsService.calculateRemainingMinutes({
      startedAt: new Date(),
      resumedAt: null,
      pausedAt: null,
      durationMinutes: 60,
      extendedMinutes: 0,
      status: SessionStatus.EXPIRED,
    });
    expect(result).toBe(0);
  });

  it('should calculate remaining for a paused session', () => {
    const startedAt = new Date(Date.now() - 20 * 60000);
    const result = sessionsService.calculateRemainingMinutes({
      startedAt,
      resumedAt: null,
      pausedAt: new Date(),
      durationMinutes: 60,
      extendedMinutes: 0,
      status: SessionStatus.PAUSED,
    });
    expect(result).toBeGreaterThanOrEqual(39);
    expect(result).toBeLessThanOrEqual(41);
  });

  it('should include extended minutes in remaining calculation', () => {
    const startedAt = new Date(Date.now() - 20 * 60000);
    const result = sessionsService.calculateRemainingMinutes({
      startedAt,
      resumedAt: null,
      pausedAt: new Date(),
      durationMinutes: 60,
      extendedMinutes: 30,
      status: SessionStatus.PAUSED,
    });
    expect(result).toBeGreaterThanOrEqual(69);
    expect(result).toBeLessThanOrEqual(71);
  });

  it('should return 0 when elapsed exceeds duration + extended', () => {
    const startedAt = new Date(Date.now() - 120 * 60000);
    const result = sessionsService.calculateRemainingMinutes({
      startedAt,
      resumedAt: null,
      pausedAt: null,
      durationMinutes: 60,
      extendedMinutes: 0,
      status: SessionStatus.ACTIVE,
    });
    expect(result).toBe(0);
  });
});

describe('SessionsService - daily limit exceeded', () => {
  it('should prevent session start when daily limit is exceeded', async () => {
    const prismaMock = {
      device: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          parentId: 'p1',
          childId: 'c1',
          status: 'ONLINE',
        }),
      },
      session: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          { durationMinutes: 50, extendedMinutes: 0, remainingMinutes: 0 },
        ]),
        create: jest.fn(),
      },
    } as unknown as PrismaService;

    const rulesServiceMock = {
      getDailyLimit: jest.fn().mockResolvedValue(60),
      getActiveRulesForChild: jest.fn().mockResolvedValue([]),
    } as unknown as RulesService;

    const service = new SessionsService(prismaMock, rulesServiceMock);

    await expect(
      service.start('p1', { deviceId: 'd1', durationMinutes: 30 }),
    ).rejects.toThrow('Daily limit exceeded');
  });
});
