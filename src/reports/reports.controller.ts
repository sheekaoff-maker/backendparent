import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

function parseOffset(raw?: string): number {
  const n = Number.parseInt(raw ?? '0', 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 52); // cap how far back a client can page
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('weekly')
  @ApiOperation({ summary: 'Weekly usage report (rolling 7-day window)' })
  @ApiQuery({ name: 'childId', required: false })
  @ApiQuery({ name: 'offset', required: false, description: '0 = this week, 1 = last week, …' })
  weekly(
    @CurrentUser('sub') parentId: string,
    @Query('childId') childId?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.weekly(parentId, childId || undefined, parseOffset(offset));
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Monthly usage report (rolling 30-day window)' })
  @ApiQuery({ name: 'childId', required: false })
  @ApiQuery({ name: 'offset', required: false, description: '0 = this month, 1 = last month, …' })
  monthly(
    @CurrentUser('sub') parentId: string,
    @Query('childId') childId?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.monthly(parentId, childId || undefined, parseOffset(offset));
  }
}
