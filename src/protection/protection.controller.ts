import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProtectionService } from './protection.service';
import { UpsertScheduleDto } from './dto/schedule.dto';

@ApiTags('Protection & Insights')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('devices')
export class ProtectionController {
  constructor(private readonly service: ProtectionService) {}

  @Get(':id/protection-score')
  @ApiOperation({ summary: '0-100 protection score with HIGH/MEDIUM/LOW level + breakdown' })
  score(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.service.getProtectionScore(parentId, id);
  }

  @Get(':id/insights')
  @ApiOperation({ summary: 'Full dashboard payload: score, status, top domains, recommendations' })
  insights(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.service.getInsights(parentId, id);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get auto-block schedule (daily limit + bedtime) for a device' })
  getSchedule(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.service.getSchedule(parentId, id);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Upsert auto-block schedule (daily limit + bedtime) for a device' })
  upsertSchedule(
    @CurrentUser('sub') parentId: string,
    @Param('id') id: string,
    @Body() dto: UpsertScheduleDto,
  ) {
    return this.service.upsertSchedule(parentId, id, dto);
  }
}
