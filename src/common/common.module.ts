import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  imports: [
    // Registered async so the signing/verifying secret is read from the
    // fully-loaded config at runtime — NOT captured from process.env at
    // import time (which happens before ConfigModule loads the .env file and
    // would silently fall back to a weak/mismatched default).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRATION', '15m'),
        },
      }),
    }),
  ],
  providers: [PrismaService, EncryptionService],
  exports: [PrismaService, EncryptionService, JwtModule],
})
export class CommonModule {}
