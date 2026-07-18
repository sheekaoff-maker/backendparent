import { Module } from '@nestjs/common';
import { BandwidthService } from './bandwidth.service';
import { BandwidthController } from './bandwidth.controller';

@Module({
  controllers: [BandwidthController],
  providers: [BandwidthService],
  exports: [BandwidthService],
})
export class BandwidthModule {}
