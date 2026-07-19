import { MetricsController } from '../src/metrics/metrics.controller';
import { MetricsService } from '../src/metrics/metrics.service';

describe('MetricsController', () => {
  it('scrape() returns the registry in Prometheus text format', async () => {
    const service = new MetricsService();
    service.onModuleInit();
    service.recordHttpRequest('GET', '/health', 200, 0.001);

    const controller = new MetricsController(service);
    const output = await controller.scrape();

    expect(output).toContain('# HELP http_requests_total');
    expect(output).toContain('# TYPE http_requests_total counter');
  });
});
