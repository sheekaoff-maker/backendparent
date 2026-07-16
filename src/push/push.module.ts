import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { FcmSender } from './fcm.sender';

@Module({
  controllers: [PushController],
  providers: [PushService, FcmSender],
  exports: [PushService],
})
export class PushModule {}
