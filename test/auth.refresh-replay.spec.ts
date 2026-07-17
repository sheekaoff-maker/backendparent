import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from '../src/auth/auth.service';

/**
 * End-to-end regression for the refresh-token REPLAY bug.
 *
 * Critically, this uses the REAL JwtService (not a stub) and a STATEFUL prisma
 * mock that actually rotates the stored hash. The old unit tests stubbed
 * signAsync to a constant, which hid the defect: two tokens minted in the same
 * second were byte-identical (JWT `iat` is 1-second granular, no jti), so
 * rotation was a no-op and a replay of the same token still matched.
 *
 * This test issues both refreshes back-to-back (same wall-clock second) and
 * asserts: first = success, second (replay of the same token) = 401.
 */
const SECRET = 'x'.repeat(48);
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function statefulPrisma(initialHash: string) {
  const user: any = { id: 'u1', email: 'a@b.com', role: 'PARENT', refreshToken: initialHash };
  return {
    _user: user,
    user: {
      findUnique: async ({ where }: any) => (where.id === user.id ? { ...user } : null),
      update: async ({ data }: any) => {
        Object.assign(user, data);
        return { ...user };
      },
      // Atomic compare-and-swap: only rotates if the stored hash still matches.
      updateMany: async ({ where, data }: any) => {
        if (where.id === user.id && user.refreshToken === where.refreshToken) {
          Object.assign(user, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  } as any;
}

function config() {
  const values: Record<string, string> = {
    JWT_SECRET: SECRET,
    JWT_REFRESH_SECRET: SECRET,
    JWT_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
  };
  return { get: (k: string, d?: string) => values[k] ?? d } as any;
}

describe('AuthService refresh — replay hardening (real JWT + stateful store)', () => {
  it('rejects a replayed refresh token even when issued in the same second (first 200, second 401)', async () => {
    const jwt = new JwtService({});
    // Mint a genuine initial refresh token and seed the stored hash.
    const t0 = await jwt.signAsync(
      { sub: 'u1', email: 'a@b.com', role: 'PARENT', jti: 'seed' },
      { secret: SECRET, expiresIn: '7d' },
    );
    const prisma = statefulPrisma(sha256(t0));
    const service = new AuthService(prisma, jwt, config());

    // First refresh with t0 → succeeds, rotates the stored hash.
    const first = await service.refresh({ refreshToken: t0 } as any);
    expect(first.accessToken).toBeTruthy();
    expect(first.refreshToken).not.toBe(t0); // a genuinely new token (unique jti)

    // Second refresh replays the SAME t0 immediately (same second) → must fail.
    await expect(service.refresh({ refreshToken: t0 } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    // And the freshly issued token still works exactly once.
    const third = await service.refresh({ refreshToken: first.refreshToken } as any);
    expect(third.accessToken).toBeTruthy();
    await expect(
      service.refresh({ refreshToken: first.refreshToken } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('two tokens minted back-to-back are never identical (unique jti)', async () => {
    const jwt = new JwtService({});
    const prisma = statefulPrisma('unused');
    const service: any = new AuthService(prisma, jwt, config());
    const a = await service.generateTokens('u1', 'a@b.com', 'PARENT');
    const b = await service.generateTokens('u1', 'a@b.com', 'PARENT');
    expect(a.refreshToken).not.toBe(b.refreshToken);
    expect(a.accessToken).not.toBe(b.accessToken);
  });
});
