import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';

jest.mock('bcrypt');

const VALID_SECRET = 'x'.repeat(40);

function buildConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    JWT_SECRET: VALID_SECRET,
    JWT_REFRESH_SECRET: VALID_SECRET,
    JWT_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as any;
}

function buildPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    subscription: { create: jest.fn() },
  } as any;
}

function buildJwt() {
  return {
    signAsync: jest.fn().mockImplementation((payload, opts) =>
      Promise.resolve(opts.expiresIn === '7d' ? 'refresh-token' : 'access-token'),
    ),
    verifyAsync: jest.fn(),
  } as any;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let jwt: ReturnType<typeof buildJwt>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrisma();
    jwt = buildJwt();
    service = new AuthService(prisma, jwt, buildConfig());
  });

  describe('constructor', () => {
    it('refuses to start with a short JWT secret', () => {
      expect(() => new AuthService(prisma, jwt, buildConfig({ JWT_SECRET: 'short' }))).toThrow();
    });
  });

  describe('register', () => {
    it('always creates a PARENT and never a client-supplied role', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', role: Role.PARENT });

      await service.register({ email: 'A@B.com', password: 'password123' } as any);

      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.role).toBe(Role.PARENT);
      // email is normalised to lowercase
      expect(createArg.data.email).toBe('a@b.com');
      // subscription provisioned in the same write
      expect(createArg.data.subscription).toEqual({ create: { plan: 'FREE' } });
    });

    it('rejects a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register({ email: 'a@b.com', password: 'password123' } as any),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('locks the account after too many failed attempts', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: Role.PARENT,
        passwordHash: 'hash',
        failedLoginAttempts: 4,
        lockedUntil: null,
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      const updateArg = prisma.user.update.mock.calls[0][0];
      expect(updateArg.data.failedLoginAttempts).toBe(5);
      expect(updateArg.data.lockedUntil).toBeInstanceOf(Date);
    });

    it('blocks login while the account is locked', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: 'hash',
        lockedUntil: new Date(Date.now() + 60_000),
        failedLoginAttempts: 5,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'whatever' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('issues tokens and stores a HASHED refresh token on success', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: Role.PARENT,
        passwordHash: 'hash',
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      const result = await service.login({ email: 'a@b.com', password: 'right' } as any);

      expect(result.accessToken).toBe('access-token');
      const storedRefresh = prisma.user.update.mock.calls.at(-1)[0].data.refreshToken;
      // Never persist the raw token
      expect(storedRefresh).toBe(sha256('refresh-token'));
      expect(storedRefresh).not.toBe('refresh-token');
    });
  });

  describe('refresh', () => {
    it('rejects when the presented token hash does not match storage', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: Role.PARENT,
        refreshToken: sha256('a-different-token'),
      });
      await expect(
        service.refresh({ refreshToken: 'presented-token' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rotates tokens when the presented token hash matches', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: Role.PARENT,
        refreshToken: sha256('presented-token'),
      });
      const result = await service.refresh({ refreshToken: 'presented-token' } as any);
      expect(result.accessToken).toBe('access-token');
    });
  });
});
