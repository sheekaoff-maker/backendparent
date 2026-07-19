import { of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from '../src/common/interceptors/request-logging.interceptor';
import { MetricsService } from '../src/metrics/metrics.service';

function buildContext({ headers = {}, route, method = 'GET', originalUrl = '/devices/abc123' }: any = {}) {
  const res = { statusCode: 200, setHeader: jest.fn() };
  const req: any = { headers, method, originalUrl, route };
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    req,
    res,
  } as any;
}

describe('RequestLoggingInterceptor', () => {
  let metrics: MetricsService;
  let interceptor: RequestLoggingInterceptor;

  beforeEach(() => {
    metrics = new MetricsService();
    metrics.onModuleInit();
    jest.spyOn(metrics, 'recordHttpRequest');
    interceptor = new RequestLoggingInterceptor(metrics);
  });

  it('generates a request id, echoes it on the response, and attaches it to the request', (done) => {
    const ctx = buildContext();
    interceptor.intercept(ctx, { handle: () => of('ok') }).subscribe(() => {
      expect(ctx.req.requestId).toBeDefined();
      expect(ctx.res.setHeader).toHaveBeenCalledWith('x-request-id', ctx.req.requestId);
      done();
    });
  });

  it('honors an inbound x-request-id header instead of generating a new one', (done) => {
    const ctx = buildContext({ headers: { 'x-request-id': 'client-supplied-id' } });
    interceptor.intercept(ctx, { handle: () => of('ok') }).subscribe(() => {
      expect(ctx.req.requestId).toBe('client-supplied-id');
      done();
    });
  });

  it('records metrics using the matched route pattern, not the raw URL with its params', (done) => {
    const ctx = buildContext({ route: { path: '/devices/:id' }, originalUrl: '/devices/abc123' });
    interceptor.intercept(ctx, { handle: () => of('ok') }).subscribe(() => {
      expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/devices/:id',
        200,
        expect.any(Number),
      );
      done();
    });
  });

  it('falls back to "unmatched" for requests with no resolved Express route (e.g. 404s)', (done) => {
    const ctx = buildContext({ route: undefined });
    interceptor.intercept(ctx, { handle: () => of('ok') }).subscribe(() => {
      expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        'unmatched',
        200,
        expect.any(Number),
      );
      done();
    });
  });

  it('still records metrics and logs when the handler errors', (done) => {
    const ctx = buildContext({ route: { path: '/devices' } });
    ctx.res.statusCode = 500;
    interceptor.intercept(ctx, { handle: () => throwError(() => new Error('boom')) }).subscribe({
      error: () => {
        expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
          'GET',
          '/devices',
          500,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('passes non-HTTP execution contexts straight through without touching metrics', (done) => {
    const ctx = { getType: () => 'rpc' } as any;
    interceptor.intercept(ctx, { handle: () => of('ok') }).subscribe(() => {
      expect(metrics.recordHttpRequest).not.toHaveBeenCalled();
      done();
    });
  });
});
