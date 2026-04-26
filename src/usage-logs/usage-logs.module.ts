import { Module } from '@nestjs/common';
import { UsageLogsService } from './usage-logs.service';
import { UsageLogsController } from './usage-logs.controller';

@Module({
  controllers: [UsageLogsController],
  providers: [UsageLogsService],
  exports: [UsageLogsService],
})
export class UsageLogsModule {}
