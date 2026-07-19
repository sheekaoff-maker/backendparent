import { Module } from '@nestjs/common';
import { RouterDatabaseService } from './router-database.service';
import { CapabilityEngineService } from './capability-engine.service';
import { RouterDetectionService } from './router-detection.service';
import { RouterDetectionController } from './router-detection.controller';
import { RouterCommandService } from './router-command.service';
import { RouterCommandController } from './router-command.controller';
import { SmartBlockEngineService } from './smart-block-engine.service';
import { RouterIntegrationService } from './router-integration.service';
import { RouterIntegrationController } from './router-integration.controller';

@Module({
  controllers: [RouterDetectionController, RouterCommandController, RouterIntegrationController],
  providers: [
    RouterDatabaseService,
    CapabilityEngineService,
    RouterDetectionService,
    RouterCommandService,
    SmartBlockEngineService,
    RouterIntegrationService,
  ],
  exports: [RouterDatabaseService, CapabilityEngineService, RouterCommandService],
})
export class RouterIntegrationModule {}
