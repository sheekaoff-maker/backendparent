import { Module } from '@nestjs/common';
import { PairingController, DnsPairController } from './pairing.controller';
import { PairingService } from './pairing.service';
import { PairingRepository } from './pairing.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PairingController, DnsPairController],
  providers: [PairingService, PairingRepository],
  exports: [PairingService],
})
export class PairingModule {}
