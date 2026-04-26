import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { SessionsModule } from '../sessions/sessions.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SessionsModule,
    EnforcementModule,
    NotificationsModule,
    AuditModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
