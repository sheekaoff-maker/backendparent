import { Module } from '@nestjs/common';
import { ProtectionService } from './protection.service';
import { ProtectionController } from './protection.controller';

@Module({
  controllers: [ProtectionController],
  providers: [ProtectionService],
  exports: [ProtectionService],
})
export class ProtectionModule {}
