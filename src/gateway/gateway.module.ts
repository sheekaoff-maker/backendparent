import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { GatewayController } from './gateway.controller';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [GatewayController],
  providers: [GatewayService, DeviceFingerprintService],
  exports: [GatewayService],
})
export class GatewayModule {}
