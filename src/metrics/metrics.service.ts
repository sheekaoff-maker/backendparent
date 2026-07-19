import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new client.Registry();

  readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  // Note: this histogram, labeled by route, already covers DNS-check
  // latency — the DNS service's every query hits GET /dns/policy/check as a
  // plain HTTP request, so `http_request_duration_seconds{route="/dns/policy/check"}`
  // *is* the DNS decision latency metric. No separate metric needed.

  readonly dbQueryDuration = new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Prisma query duration in seconds',
    labelNames: ['model', 'action'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [this.registry],
  });

  onModuleInit() {
    client.collectDefaultMetrics({ register: this.registry, prefix: 'guardtime_backend_' });
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number) {
    const labels = { method, route, status: String(status) };
    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
  }
}
