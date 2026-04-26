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

    // 4. Check blocked domains
    const blockedDomain = await this.findBlockedDomain(domain);
    if (blockedDomain) {
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
    // Check exact match and parent domain matches
    const parts = domain.split('.');
    const candidates: string[] = [domain];

    // e.g. for "www.youtube.com" also check "youtube.com"
    for (let i = 1; i < parts.length - 1; i++) {
      candidates.push(parts.slice(i).join('.'));
    }

    return this.prisma.blockedDomain.findFirst({
      where: {
        domain: { in: candidates },
      },
    });
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
