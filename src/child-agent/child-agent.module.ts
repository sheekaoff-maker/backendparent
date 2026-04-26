import { Module } from '@nestjs/common';
import { ChildAgentService } from './child-agent.service';
import { ChildAgentController } from './child-agent.controller';
import { RulesModule } from '../rules/rules.module';
import { UsageLogsModule } from '../usage-logs/usage-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RulesModule, UsageLogsModule, NotificationsModule],
  controllers: [ChildAgentController],
  providers: [ChildAgentService],
  exports: [ChildAgentService],
})
export class ChildAgentModule {}
