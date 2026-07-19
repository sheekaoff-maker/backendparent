import { CommandQueueService } from '../src/queue/command-queue.service';
import { MetricsService } from '../src/metrics/metrics.service';

function fakeQueue(counts: { waiting?: number; active?: number; delayed?: number; failed?: number } = {}) {
  return {
    add: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(counts.waiting ?? 0),
    getActiveCount: jest.fn().mockResolvedValue(counts.active ?? 0),
    getDelayedCount: jest.fn().mockResolvedValue(counts.delayed ?? 0),
    getFailedCount: jest.fn().mockResolvedValue(counts.failed ?? 0),
  } as any;
}

describe('CommandQueueService queue metrics', () => {
  it('registers gauges that reflect real BullMQ counts on scrape', async () => {
    const metrics = new MetricsService();
    metrics.onModuleInit();
    const queue = fakeQueue({ waiting: 3, active: 1, delayed: 2, failed: 5 });
    new CommandQueueService(queue, metrics);

    const output = await metrics.registry.metrics();
    expect(output).toMatch(/queue_jobs_waiting 3/);
    expect(output).toMatch(/queue_jobs_active 1/);
    expect(output).toMatch(/queue_jobs_delayed 2/);
    expect(output).toMatch(/queue_jobs_failed 5/);
  });

  it('does not throw when re-constructed against the same registry (guards duplicate registration)', async () => {
    const metrics = new MetricsService();
    metrics.onModuleInit();
    const queue1 = fakeQueue({ waiting: 1 });
    const queue2 = fakeQueue({ waiting: 9 });

    expect(() => new CommandQueueService(queue1, metrics)).not.toThrow();
    expect(() => new CommandQueueService(queue2, metrics)).not.toThrow();
  });

  it('enqueueCommand adds a job with retry/backoff configured', async () => {
    const metrics = new MetricsService();
    metrics.onModuleInit();
    const queue = fakeQueue();
    const service = new CommandQueueService(queue, metrics);

    await service.enqueueCommand({
      commandId: 'c1', deviceId: 'd1', type: 'BLOCK_APPS', payload: '{}', controlMethod: 'ANDROID_AGENT',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'deliver-command',
      expect.objectContaining({ commandId: 'c1' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('getQueueStatus reports the same counts BullMQ reports', async () => {
    const metrics = new MetricsService();
    metrics.onModuleInit();
    const queue = fakeQueue({ waiting: 7, active: 2, delayed: 0, failed: 1 });
    const service = new CommandQueueService(queue, metrics);

    await expect(service.getQueueStatus()).resolves.toEqual({
      waiting: 7, active: 2, delayed: 0, failed: 1,
    });
  });
});
