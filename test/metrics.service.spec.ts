import { MetricsService } from '../src/metrics/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
    service.onModuleInit();
  });

  it('exposes default process metrics (memory/CPU/event loop) under the guardtime_backend_ prefix', async () => {
    const output = await service.registry.metrics();
    expect(output).toMatch(/guardtime_backend_process_resident_memory_bytes/);
  });

  it('records an HTTP request into both the counter and the duration histogram', async () => {
    service.recordHttpRequest('GET', '/devices', 200, 0.042);
    const output = await service.registry.metrics();

    expect(output).toMatch(/http_requests_total\{method="GET",route="\/devices",status="200"\} 1/);
    expect(output).toMatch(/http_request_duration_seconds_bucket/);
  });

  it('accumulates counts across multiple requests to the same route', async () => {
    service.recordHttpRequest('GET', '/devices', 200, 0.01);
    service.recordHttpRequest('GET', '/devices', 200, 0.02);
    const output = await service.registry.metrics();
    expect(output).toMatch(/http_requests_total\{method="GET",route="\/devices",status="200"\} 2/);
  });

  it('labels requests to different routes/statuses independently', async () => {
    service.recordHttpRequest('GET', '/devices', 200, 0.01);
    service.recordHttpRequest('POST', '/devices', 500, 0.5);
    const output = await service.registry.metrics();
    expect(output).toMatch(/http_requests_total\{method="GET",route="\/devices",status="200"\} 1/);
    expect(output).toMatch(/http_requests_total\{method="POST",route="\/devices",status="500"\} 1/);
  });
});
