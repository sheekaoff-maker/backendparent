import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  @ApiOperation({ summary: 'Root health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  root() {
    this.logger.log('Health check: /');
    return { status: 'ok' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    this.logger.log('Health check: /health');
    return { status: 'ok' };
  }
}
