import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../common/dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { Role } from '@prisma/client';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!jwtSecret || jwtSecret.length < 32) {
      throw new InternalServerErrorException(
        'JWT_SECRET must be defined and at least 32 characters long. Refusing to start.',
      );
    }
    if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
      throw new InternalServerErrorException(
        'JWT_REFRESH_SECRET must be defined and at least 32 characters long. Refusing to start.',
      );
    }

    this.jwtSecret = jwtSecret;
    this.jwtRefreshSecret = jwtRefreshSecret;
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRATION', '15m');
    this.jwtRefreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Public self-registration always creates a PARENT. Never trust a
    // client-supplied role — elevated roles are provisioned out-of-band.
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: Role.PARENT,
        subscription: { create: { plan: 'FREE' } },
      },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Run timing-safe comparison to prevent timing attacks on email enumeration
      await bcrypt.compare('dummy_password_for_timing', '$2b$12$dummyhashfordummyuserdummyhashfordummyuser');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lockout
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account is temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minute(s).`,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000)
            : undefined,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Successful login: reset failed attempts (only write when needed)
    if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const presentedHash = this.hashToken(dto.refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    // Compare against the stored HASH — refresh tokens are never persisted in
    // plaintext, so a DB leak does not yield usable tokens.
    if (!user || !user.refreshToken || user.refreshToken !== presentedHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    // Atomic compare-and-swap rotation: the new hash is written ONLY if the
    // stored hash still equals the presented one. A replayed or concurrent
    // refresh with the same token matches zero rows → rejected. This closes the
    // read-then-write replay window that a plain findUnique+update leaves open.
    const swap = await this.prisma.user.updateMany({
      where: { id: user.id, refreshToken: presentedHash },
      data: { refreshToken: this.hashToken(tokens.refreshToken) },
    });
    if (swap.count === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  /** Generate a fresh token pair and persist the rotated refresh-token hash. */
  private async issueTokens(sub: string, email: string, role: Role) {
    const tokens = await this.generateTokens(sub, email, role);
    await this.prisma.user.update({
      where: { id: sub },
      data: { refreshToken: this.hashToken(tokens.refreshToken) },
    });
    return tokens;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(sub: string, email: string, role: Role) {
    // A unique jti per token guarantees every issuance is byte-distinct. Without
    // it, JWT `iat` has only 1-second resolution, so two tokens minted for the
    // same user in the same second are IDENTICAL — making refresh rotation a
    // no-op (the "new" hash equals the old one) and leaving a ~1s replay window.
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub, email, role, jti: randomUUID() },
        { secret: this.jwtSecret, expiresIn: this.jwtExpiresIn },
      ),
      this.jwtService.signAsync(
        { sub, email, role, jti: randomUUID() },
        { secret: this.jwtRefreshSecret, expiresIn: this.jwtRefreshExpiresIn },
      ),
    ]);
    return { accessToken, refreshToken, userId: sub, role };
  }
}
