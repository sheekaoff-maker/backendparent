import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RouterDatabaseService } from './router-database.service';
import { CapabilityEngineService } from './capability-engine.service';
import { RouterDetectionService } from './router-detection.service';
import { RouterDetectionController } from './router-detection.controller';
import { RouterCommandService } from './router-command.service';
import { RouterCommandController } from './router-command.controller';
import { SmartBlockEngineService } from './smart-block-engine.service';
import { RouterIntegrationService } from './router-integration.service';
import { RouterIntegrationController } from './router-integration.controller';
import { RouterCapabilityScoreService } from './router-capability-score.service';

@Module({
  imports: [AuditModule],
  controllers: [RouterDetectionController, RouterCommandController, RouterIntegrationController],
  providers: [
    RouterDatabaseService,
    CapabilityEngineService,
    RouterDetectionService,
    RouterCommandService,
    SmartBlockEngineService,
    RouterIntegrationService,
    RouterCapabilityScoreService,
  ],
  exports: [RouterDatabaseService, CapabilityEngineService, RouterCommandService, SmartBlockEngineService, RouterCapabilityScoreService],
})
export class RouterIntegrationModule {}
