import { HealthService } from '../src/health/health.service';

function build(firebaseStatus: 'ready' | 'not_configured' | 'error', dbUp = true, redisUp = true) {
  const prisma = {
    $queryRaw: dbUp ? jest.fn().mockResolvedValue([{ '?column?': 1 }]) : jest.fn().mockRejectedValue(new Error('down')),
  } as any;
  const cache = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(redisUp ? '1' : undefined),
  } as any;
  const firebase = { initStatus: firebaseStatus } as any;
  return new HealthService(prisma, cache, firebase);
}

describe('HealthService.readiness — firebase component', () => {
  it('reports firebase=up and overall ok when Firebase initialized successfully', async () => {
    const svc = build('ready');
    const report = await svc.readiness();
    expect(report.components.firebase).toBe('up');
    expect(report.status).toBe('ok');
  });

  it('reports firebase=not_configured WITHOUT degrading overall status (opt-out, not a fault)', async () => {
    const svc = build('not_configured');
    const report = await svc.readiness();
    expect(report.components.firebase).toBe('not_configured');
    expect(report.status).toBe('ok');
  });

  it('reports firebase=down AND degrades overall status on a real init error', async () => {
    const svc = build('error');
    const report = await svc.readiness();
    expect(report.components.firebase).toBe('down');
    expect(report.status).toBe('degraded');
  });

  it('degrades when the database is down regardless of firebase state', async () => {
    const svc = build('ready', false, true);
    const report = await svc.readiness();
    expect(report.components.database).toBe('down');
    expect(report.status).toBe('degraded');
  });
});
