import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../common/prisma.service';

type ComponentStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  components: {
    database: ComponentStatus;
    redis: ComponentStatus;
    api: ComponentStatus;
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Deep readiness probe: verifies the two dependencies the platform cannot
   * run without. Used by orchestrators (Railway/k8s) and surfaced to parents
   * as a "System status" indicator — relevant here because filtering fails
   * open, so a degraded backend means protection may be silently reduced.
   */
  async readiness(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = database === 'up' && redis === 'up';
    return {
      status: allUp ? 'ok' : 'degraded',
      components: { database, redis, api: 'up' },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (err: unknown) {
      this.logger.error(`Database readiness check failed: ${errorMessage(err)}`);
      return 'down';
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    try {
      const probeKey = 'health:probe';
      await this.cache.set(probeKey, '1', 5_000);
      const value = await this.cache.get<string>(probeKey);
      return value === '1' ? 'up' : 'down';
    } catch (err: unknown) {
      this.logger.error(`Redis readiness check failed: ${errorMessage(err)}`);
      return 'down';
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
