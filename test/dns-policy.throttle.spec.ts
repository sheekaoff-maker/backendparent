import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DnsPolicyController } from '../src/dns-policy/dns-policy.controller';

/**
 * Proves the DNS policy hot-path endpoint is exempt from the global rate
 * limiter, while the limiter still protects every other route.
 *
 * Builds the REAL ThrottlerGuard via Nest DI (same wiring as production) and
 * runs it against the REAL DnsPolicyController metadata (the `@SkipThrottle()`
 * decorator), so this test fails if the decorator is ever removed. No HTTP
 * layer / supertest required.
 */
function makeContext(
  targetClass: unknown,
  handler: unknown,
  ip: string,
): ExecutionContext {
  const req = { ip, ips: [] as string[], headers: {}, connection: { remoteAddress: ip } };
  const res = { header: () => undefined, setHeader: () => undefined };
  return {
    getClass: () => targetClass,
    getHandler: () => handler,
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

describe('DnsPolicyController rate-limiting', () => {
  let guard: ThrottlerGuard;
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      // Low limit so the "throttling still works" contrast is quick and obvious.
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      providers: [ThrottlerGuard],
    }).compile();
    guard = moduleRef.get(ThrottlerGuard);
    // .compile() does not run lifecycle hooks; the guard builds its throttler
    // list in onModuleInit, so trigger it explicitly.
    await guard.onModuleInit();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('never throttles /dns/policy/check even at high volume (500 rapid calls)', async () => {
    const ctx = makeContext(
      DnsPolicyController,
      DnsPolicyController.prototype.check,
      '10.0.0.1',
    );
    for (let i = 0; i < 500; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
  });

  it('still throttles a normal (non-skipped) route once the limit is exceeded', async () => {
    class NormalController {
      handler() {
        return 'ok';
      }
    }
    const ctx = makeContext(
      NormalController,
      NormalController.prototype.handler,
      '10.0.0.2',
    );

    // The first `limit` requests pass…
    for (let i = 0; i < 5; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
    // …the next one is rejected — proving the limiter is genuinely active.
    await expect(guard.canActivate(ctx)).rejects.toBeDefined();
  });
});
