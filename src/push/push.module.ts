import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { FcmSender } from './fcm.sender';
import { FirebaseService } from './firebase.service';

@Module({
  controllers: [PushController],
  providers: [PushService, FcmSender, FirebaseService],
  exports: [PushService, FirebaseService],
})
export class PushModule {}
