import { Module } from '@nestjs/common';
import { EnforcementService } from './enforcement.service';
import { EnforcementController } from './enforcement.controller';
import { AndroidAgentAdapter } from './adapters/android-agent.adapter';
import { IosScreenTimeAdapter } from './adapters/ios-screen-time.adapter';
import { XboxAdapter } from './adapters/xbox.adapter';
import { NetworkGatewayAdapter } from './adapters/network-gateway.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [EnforcementController],
  providers: [
    EnforcementService,
    AndroidAgentAdapter,
    IosScreenTimeAdapter,
    XboxAdapter,
    NetworkGatewayAdapter,
    MockAdapter,
  ],
  exports: [EnforcementService, MockAdapter],
})
export class EnforcementModule {}
