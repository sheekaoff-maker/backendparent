import { Module } from '@nestjs/common';
import { OfflineControlController } from './offline-control.controller';
import { OfflineControlService } from './offline-control.service';

@Module({
  controllers: [OfflineControlController],
  providers: [OfflineControlService],
  exports: [OfflineControlService],
})
export class OfflineControlModule {}
