import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../../metrics/metrics.service';

/**
 * Assigns a correlation id to every request (honouring an inbound
 * `x-request-id` from a trusted proxy), echoes it back on the response,
 * emits one structured access-log line per request with method, path, status
 * and duration, and records the same duration into Prometheus. The request
 * id is also readable by the exception filter so client errors can be traced
 * back to server logs.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { requestId?: string; route?: { path: string } }>();
    const res = http.getResponse<Response>();

    const requestId =
      (req.headers['x-request-id'] as string | undefined)?.slice(0, 128) || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const start = process.hrtime.bigint();
    const { method, originalUrl } = req;

    const record = () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const status = res.statusCode;
      const line = `${method} ${originalUrl} ${status} ${durationMs.toFixed(1)}ms [${requestId}]`;
      if (status >= 500) {
        this.logger.error(line);
      } else if (status >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }

      // Route pattern (e.g. "/devices/:id"), not the raw URL — using the raw
      // URL as a metric label would create one Prometheus time series per
      // unique id ever requested, an unbounded-cardinality footgun.
      const route = req.route?.path || 'unmatched';
      this.metrics.recordHttpRequest(method, route, status, durationMs / 1000);
    };

    return next.handle().pipe(
      tap({
        next: record,
        error: record,
      }),
    );
  }
}
