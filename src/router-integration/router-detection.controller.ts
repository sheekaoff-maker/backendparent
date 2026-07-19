import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RouterDetectionService } from './router-detection.service';
import { RouterDetectionReportDto } from './dto/router-detection.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GatewayTokenGuard } from '../common/guards/gateway-token.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Router Integration')
@Controller()
export class RouterDetectionController {
  constructor(private routerDetectionService: RouterDetectionService) {}

  @Post('gateway/router/detection')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Report a router detection scan result (gateway-agent, Router Integration Engine)' })
  async reportDetection(@Req() req: any, @Body() dto: RouterDetectionReportDto) {
    return this.routerDetectionService.recordDetection(req.gateway.id, dto);
  }

  @Get('router-integration/:gatewayId/detected')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the router detected on this gateway\'s LAN, if any' })
  async getDetected(@CurrentUser('sub') parentId: string, @Param('gatewayId') gatewayId: string) {
    return this.routerDetectionService.getDetectedRouter(parentId, gatewayId);
  }
}
