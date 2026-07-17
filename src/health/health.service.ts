import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../common/prisma.service';
import { FirebaseService } from '../push/firebase.service';

type ComponentStatus = 'up' | 'down';
type FirebaseComponentStatus = 'up' | 'down' | 'not_configured';

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  components: {
    database: ComponentStatus;
    redis: ComponentStatus;
    api: ComponentStatus;
    firebase: FirebaseComponentStatus;
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * Deep readiness probe: verifies the dependencies the platform relies on.
   * Database/Redis are required; Firebase is optional (push is a
   * degrade-gracefully feature) so its absence does NOT flip overall status
   * to degraded — only an actual init ERROR (bad credential) does, since that
   * indicates a misconfiguration worth fixing, not a deliberate opt-out.
   */
  async readiness(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const firebase = this.checkFirebase();

    const allUp = database === 'up' && redis === 'up' && firebase !== 'down';
    return {
      status: allUp ? 'ok' : 'degraded',
      components: { database, redis, api: 'up', firebase },
      timestamp: new Date().toISOString(),
    };
  }

  private checkFirebase(): FirebaseComponentStatus {
    switch (this.firebase.initStatus) {
      case 'ready':
        return 'up';
      case 'error':
        return 'down';
      default:
        return 'not_configured';
    }
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
