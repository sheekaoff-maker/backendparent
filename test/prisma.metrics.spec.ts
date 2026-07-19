import { PrismaService } from '../src/common/prisma.service';
import { MetricsService } from '../src/metrics/metrics.service';

describe('PrismaService query metrics', () => {
  it('records query duration into the shared histogram, labeled by model+action', async () => {
    const metrics = new MetricsService();
    metrics.onModuleInit();
    const prisma = new PrismaService(metrics);

    // $connect talks to a real DB — not available in this unit test, and
    // not needed to exercise the $use middleware registration itself.
    jest.spyOn(prisma as any, '$connect').mockResolvedValue(undefined);
    let capturedMiddleware: any;
    jest.spyOn(prisma as any, '$use').mockImplementation((mw: any) => {
      capturedMiddleware = mw;
    });

    await prisma.onModuleInit();
    expect(capturedMiddleware).toBeInstanceOf(Function);

    const next = jest.fn().mockResolvedValue({ id: '1' });
    const result = await capturedMiddleware({ model: 'Device', action: 'findMany' }, next);

    expect(result).toEqual({ id: '1' });
    expect(next).toHaveBeenCalled();

    const output = await metrics.registry.metrics();
    expect(output).toMatch(/db_query_duration_seconds_bucket\{le="[^"]+",model="Device",action="findMany"\}/);
  });

  it('labels raw queries (no model) as "raw"', async () => {
    const metrics = new MetricsService();
    metrics.onModuleInit();
    const prisma = new PrismaService(metrics);
    jest.spyOn(prisma as any, '$connect').mockResolvedValue(undefined);
    let capturedMiddleware: any;
    jest.spyOn(prisma as any, '$use').mockImplementation((mw: any) => {
      capturedMiddleware = mw;
    });
    await prisma.onModuleInit();

    await capturedMiddleware({ model: undefined, action: 'queryRaw' }, jest.fn().mockResolvedValue([]));

    const output = await metrics.registry.metrics();
    expect(output).toMatch(/model="raw",action="queryRaw"/);
  });
});
