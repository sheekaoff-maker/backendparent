import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness — process is up' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  root() {
    return { status: 'ok' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  health() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  @ApiOperation({
    summary: 'Readiness — deep check of database and Redis dependencies',
  })
  @HttpCode(HttpStatus.OK)
  ready() {
    return this.healthService.readiness();
  }
}
