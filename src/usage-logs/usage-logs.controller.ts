import { Controller, Post, Get, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsageLogsService } from './usage-logs.service';
import { CreateUsageLogDto } from './dto/usage-log.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Usage')
@Controller('usage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsageLogsController {
  constructor(private usageLogsService: UsageLogsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Get daily usage summary' })
  async getDaily(@Query('childId') childId: string, @Query('date') date?: string) {
    const parsedDate = date ? new Date(date) : undefined;
    return this.usageLogsService.getDailyUsage(childId, parsedDate);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get weekly usage summary' })
  async getWeekly(@Query('childId') childId: string) {
    return this.usageLogsService.getWeeklyUsage(childId);
  }

  @Get('device/:id')
  @ApiOperation({ summary: 'Get device usage report' })
  async getDeviceUsage(@Param('id') deviceId: string) {
    return this.usageLogsService.getDeviceUsage(deviceId);
  }
}
