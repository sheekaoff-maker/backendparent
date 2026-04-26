import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CheckDnsPolicyDto, DnsPolicyResponseDto } from './dto/check-dns-policy.dto';
import { DeviceStatus } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * STRICT MODE blocklist — DNS-over-HTTPS / well-known public resolvers that a
 * child could point their browser/device to in order to bypass our filtering.
 * When STRICT_MODE=true (env), we BLOCK these unconditionally for every device
 * the parent has registered. They are NOT in the seed-domains category list so
 * we keep this hardcoded for predictability.
 */
export const STRICT_MODE_DOH_DOMAINS = [
  'dns.google',
  'dns.google.com',
  'cloudflare-dns.com',
  'one.one.one.one',
  'doh.opendns.com',
  'dns.quad9.net',
  'doh.cleanbrowsing.org',
  'nextdns.io',
  'dns.nextdns.io',
  'doh.dns.sb',
  'dns.adguard.com',
  'dns.adguard-dns.com',
  'mozilla.cloudflare-dns.com',
  'chrome.cloudflare-dns.com',
];

@Injectable()
export class DnsPolicyService {
  private readonly logger = new Logger(DnsPolicyService.name);
  private readonly strictMode = (process.env.STRICT_MODE || 'false').toLowerCase() === 'true';

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private isStrictDohDomain(domain: string): boolean {
    const lower = domain.toLowerCase().replace(/\.$/, '');
    return STRICT_MODE_DOH_DOMAINS.some((d) => lower === d || lower.endsWith('.' + d));
  }

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

    // 1.4. STRICT MODE — block well-known DoH endpoints first (anti-bypass)
    if (this.strictMode && this.isStrictDohDomain(domain)) {
      const result: DnsPolicyResponseDto = {
        action: 'BLOCK',
        blockIp: '0.0.0.0',
        reason: 'STRICT_MODE_DOH',
        category: null,
      };
      await this.cacheManager.set(cacheKey, result, 30000);
      await this.logQuery(domain, sourceIp, 'BLOCK', device.id);
      this.updateDnsSeen(device.id);
      return result;
    }

    // 1.5. FULL INTERNET LOCK — blocks every domain regardless of category
    if (device.internetLocked) {
      const result: DnsPolicyResponseDto = {
        action: 'BLOCK',
        blockIp: '0.0.0.0',
        reason: 'FULL_INTERNET_LOCK',
        category: null,
      };
      await this.cacheManager.set(cacheKey, result, 30000);
      await this.logQuery(domain, sourceIp, 'BLOCK');
      this.updateDnsSeen(device.id);
      return result;
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

    // 5. Allow — but log domain as unknown so admins can categorise it later
    await this.cacheManager.set(cacheKey, allowResponse, 30000);
    await this.logQuery(domain, sourceIp, 'ALLOW', device.id);
    this.updateDnsSeen(device.id);
    this.recordUnknownDomain(domain, sourceIp, device.id);
    return allowResponse;
  }

  /**
   * Upsert into UnknownDomainLog so the admin endpoint can later classify the
   * domain into the right category. Heuristic: keep last 30 days only via the
   * lastSeenAt index — old rows can be pruned by a future cron.
   */
  private async recordUnknownDomain(domain: string, sourceIp: string, deviceId: string) {
    const lower = domain.toLowerCase().replace(/\.$/, '');
    if (!lower || lower.length > 253) return;
    try {
      await this.prisma.unknownDomainLog.upsert({
        where: { domain_device_unique: { domain: lower, deviceId } },
        update: { count: { increment: 1 }, lastSeenAt: new Date(), sourceIp },
        create: { domain: lower, sourceIp, deviceId },
      });
    } catch (err: any) {
      // unique-conflict races are fine; ignore
      this.logger.debug(`unknown-domain log skip: ${err.message}`);
    }
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

  private async logQuery(domain: string, sourceIp: string, action: string, _deviceId?: string) {
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
