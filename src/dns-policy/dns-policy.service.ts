import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CheckDnsPolicyDto, DnsPolicyResponseDto } from './dto/check-dns-policy.dto';
import { DeviceStatus } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class DnsPolicyService {
  private readonly logger = new Logger(DnsPolicyService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async checkPolicy(dto: CheckDnsPolicyDto): Promise<DnsPolicyResponseDto> {
    const { sourceIp, domain } = dto;

    // Check Redis cache first (30s TTL)
    const cacheKey = `dns:${sourceIp}:${domain}`;
    const cached = await this.cacheManager.get<DnsPolicyResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const allowResponse: DnsPolicyResponseDto = {
      action: 'ALLOW',
      blockIp: '0.0.0.0',
      reason: null,
    };

    const blockResponse = (
      reason: DnsPolicyResponseDto['reason'],
    ): DnsPolicyResponseDto => ({
      action: 'BLOCK',
      blockIp: '0.0.0.0',
      reason,
    });

    // 1. Find device by sourceIp (ipAddress or dnsSourceIp)
    const device = await this.prisma.device.findFirst({
      where: {
        OR: [{ ipAddress: sourceIp }, { dnsSourceIp: sourceIp }],
      },
    });

    if (!device) {
      await this.cacheManager.set(cacheKey, allowResponse, 30000);
      await this.logQuery(domain, sourceIp, 'ALLOW');
      return allowResponse;
    }

    // 2. If device is manually blocked
    if (device.status === DeviceStatus.BLOCKED) {
      const result = blockResponse('MANUAL_BLOCK');
      await this.cacheManager.set(cacheKey, result, 30000);
      await this.logQuery(domain, sourceIp, 'BLOCK');
      this.updateDnsSeen(device.id);
      return result;
    }

    // 3. Check active session — if expired, block
    const activeSession = await this.prisma.session.findFirst({
      where: {
        deviceId: device.id,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (activeSession) {
      const now = new Date();
      const startedAt = activeSession.resumedAt || activeSession.startedAt;
      const elapsedMs = now.getTime() - new Date(startedAt).getTime();
      const elapsedMin = elapsedMs / 60000;
      const remaining =
        activeSession.remainingMinutes -
        (elapsedMin - (activeSession.durationMinutes - activeSession.remainingMinutes));

      if (remaining <= 0) {
        const result = blockResponse('TIME_LIMIT_EXCEEDED');
        await this.cacheManager.set(cacheKey, result, 30000);
        await this.logQuery(domain, sourceIp, 'BLOCK');
        this.updateDnsSeen(device.id);
        return result;
      }
    }

    // 4. Check blocked domains (exact, parent-domain, and wildcard match)
    const blockedDomain = await this.findBlockedDomain(domain);
    if (blockedDomain) {
      // 4a. If domain is in a category, check if child has that category blocked
      if (blockedDomain.category && device.childId) {
        const categoryBlock = await this.prisma.categoryBlock.findUnique({
          where: {
            childId_category: { childId: device.childId, category: blockedDomain.category },
          },
        });
        if (categoryBlock?.active) {
          const result: DnsPolicyResponseDto = {
            action: 'BLOCK',
            blockIp: '0.0.0.0',
            reason: 'CATEGORY_BLOCKED',
            category: blockedDomain.category,
          };
          await this.cacheManager.set(cacheKey, result, 30000);
          await this.logQuery(domain, sourceIp, 'BLOCK');
          this.updateDnsSeen(device.id);
          return result;
        }
      }
      // 4b. Otherwise treat as global domain block
      const result = blockResponse('DOMAIN_BLOCKED');
      await this.cacheManager.set(cacheKey, result, 30000);
      await this.logQuery(domain, sourceIp, 'BLOCK');
      this.updateDnsSeen(device.id);
      return result;
    }

    // 5. Allow
    await this.cacheManager.set(cacheKey, allowResponse, 30000);
    await this.logQuery(domain, sourceIp, 'ALLOW');
    this.updateDnsSeen(device.id);
    return allowResponse;
  }

  private async findBlockedDomain(domain: string) {
    const lower = domain.toLowerCase().replace(/\.$/, '');

    // Build candidate list: exact + every parent suffix
    // e.g. www.api.youtube.com → [www.api.youtube.com, api.youtube.com, youtube.com]
    const parts = lower.split('.');
    const candidates: string[] = [];
    for (let i = 0; i < parts.length - 1; i++) {
      candidates.push(parts.slice(i).join('.'));
    }

    // First, exact match (works for both wildcard and non-wildcard entries)
    const match = await this.prisma.blockedDomain.findFirst({
      where: { domain: { in: candidates } },
    });
    return match;
  }

  private async logQuery(domain: string, sourceIp: string, action: string) {
    try {
      await this.prisma.dnsQueryLog.create({
        data: { domain, sourceIp, action },
      });
    } catch (error: any) {
      this.logger.warn(`Failed to log DNS query: ${error.message}`);
    }
  }

  private updateDnsSeen(deviceId: string) {
    this.prisma.device
      .update({
        where: { id: deviceId },
        data: { lastDnsSeenAt: new Date() },
      })
      .catch(() => {});
  }
}
