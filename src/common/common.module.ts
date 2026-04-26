import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRATION || '15m' },
    }),
  ],
  providers: [PrismaService, EncryptionService],
  exports: [PrismaService, EncryptionService, JwtModule],
})
export class CommonModule {}
