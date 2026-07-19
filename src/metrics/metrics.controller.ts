import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

// Excluded from Swagger (scrape-only infra, not a product API). Exposes
// internal operational data (route latency, memory/CPU), so it must be
// restricted to the Prometheus scraper at the reverse-proxy layer in
// production — see deploy/nginx/guardtime.conf.
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
