import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly metrics: MetricsService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Every query's duration, labeled by model+action (e.g. Device.findMany)
    // — the db_query_duration_seconds histogram surfaces slow queries and
    // hot models without needing to instrument every service individually.
    this.$use(async (params, next) => {
      const start = process.hrtime.bigint();
      const result = await next(params);
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.dbQueryDuration.observe(
        { model: params.model ?? 'raw', action: params.action },
        durationSeconds,
      );
      return result;
    });

    await this.$connect();
    this.logger.log('Database connection established');
  }

  // Called by Nest during graceful shutdown (app.enableShutdownHooks()).
  // Replaces the deprecated Prisma `beforeExit` event hook.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
