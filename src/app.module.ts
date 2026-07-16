import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './common/config/env.validation';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
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
import { PushModule } from './push/push.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AuditModule } from './audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { DnsPolicyModule } from './dns-policy/dns-policy.module';
import { DeviceHealthModule } from './device-health/device-health.module';
import { HealthModule } from './health/health.module';
import { CategoriesModule } from './categories/categories.module';
import { PlatformSupportModule } from './platform-support/platform-support.module';
import { OfflineControlModule } from './offline-control/offline-control.module';
import { ProtectionModule } from './protection/protection.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      // General API throttling
      { ttl: 60000, limit: 100 },
      // Auth endpoints: stricter limits
      { ttl: 60000, limit: 5, name: 'auth_login' },
      { ttl: 60000, limit: 10, name: 'auth_register' },
    ]),
    HealthModule,
    CommonModule,
    QueueModule,
    DnsPolicyModule,
    CategoriesModule,
    PlatformSupportModule,
    OfflineControlModule,
    ProtectionModule,
    AuthModule,
    ParentsModule,
    ChildrenModule,
    DevicesModule,
    DeviceHealthModule,
    RulesModule,
    SessionsModule,
    UsageLogsModule,
    EnforcementModule,
    ChildAgentModule,
    GatewayModule,
    OAuthModule,
    NotificationsModule,
    PushModule,
    ReportsModule,
    SchedulerModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
