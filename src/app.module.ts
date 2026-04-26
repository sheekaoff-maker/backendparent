import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { ParentsModule } from './parents/parents.module';
import { ChildrenModule } from './children/children.module';
import { DevicesModule } from './devices/devices.module';
import { RulesModule } from './rules/rules.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsageLogsModule } from './usage-logs/usage-logs.module';
import { EnforcementModule } from './enforcement/enforcement.module';
import { ChildAgentModule } from './child-agent/child-agent.module';
import { GatewayModule } from './gateway/gateway.module';
import { OAuthModule } from './oauth/oauth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AuditModule } from './audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { DnsPolicyModule } from './dns-policy/dns-policy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CommonModule,
    QueueModule,
    DnsPolicyModule,
    AuthModule,
    ParentsModule,
    ChildrenModule,
    DevicesModule,
    RulesModule,
    SessionsModule,
    UsageLogsModule,
    EnforcementModule,
    ChildAgentModule,
    GatewayModule,
    OAuthModule,
    NotificationsModule,
    SchedulerModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
