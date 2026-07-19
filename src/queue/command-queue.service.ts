import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as client from 'prom-client';
import { MetricsService } from '../metrics/metrics.service';

export interface CommandJobData {
  commandId: string;
  deviceId: string;
  type: string;
  payload: string;
  controlMethod: string;
}

@Injectable()
export class CommandQueueService {
  private readonly logger = new Logger(CommandQueueService.name);

  constructor(
    @InjectQueue('command-delivery') private commandQueue: Queue,
    metrics: MetricsService,
  ) {
    // Registered against the shared metrics registry, computed on-demand
    // whenever /metrics is scraped (prom-client calls collect() lazily) —
    // no polling interval to keep in sync, always reflects the real queue
    // state at scrape time. Guarded with getSingleMetric so re-constructing
    // this service (e.g. across tests reusing one MetricsService/registry)
    // doesn't hit prom-client's "metric already registered" error.
    const gauges: [string, string, () => Promise<number>][] = [
      ['queue_jobs_waiting', 'command-delivery queue: jobs waiting to be processed', () => commandQueue.getWaitingCount()],
      ['queue_jobs_active', 'command-delivery queue: jobs currently being processed', () => commandQueue.getActiveCount()],
      ['queue_jobs_delayed', 'command-delivery queue: jobs scheduled for a retry', () => commandQueue.getDelayedCount()],
      ['queue_jobs_failed', 'command-delivery queue: jobs that exhausted all retry attempts', () => commandQueue.getFailedCount()],
    ];
    for (const [name, help, getValue] of gauges) {
      if (metrics.registry.getSingleMetric(name)) continue;
      new client.Gauge({
        name,
        help,
        registers: [metrics.registry],
        async collect() {
          this.set(await getValue());
        },
      });
    }
  }

  async enqueueCommand(data: CommandJobData): Promise<void> {
    await this.commandQueue.add('deliver-command', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(`Command ${data.commandId} enqueued for device ${data.deviceId}`);
  }

  async getQueueStatus() {
    const [waiting, active, delayed, failed] = await Promise.all([
      this.commandQueue.getWaitingCount(),
      this.commandQueue.getActiveCount(),
      this.commandQueue.getDelayedCount(),
      this.commandQueue.getFailedCount(),
    ]);
    return { waiting, active, delayed, failed };
  }
}
