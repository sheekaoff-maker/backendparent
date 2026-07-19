import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RouterIntegrationService } from './router-integration.service';
import { SmartBlockEngineService } from './smart-block-engine.service';
import { RouterDatabaseService } from './router-database.service';
import { RouterSetupDto, ChangeDnsDto, RouterMacActionDto, EndGamingSessionDto } from './dto/router-integration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Router Integration')
@Controller('router-integration')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RouterIntegrationController {
  constructor(
    private routerIntegrationService: RouterIntegrationService,
    private smartBlockEngine: SmartBlockEngineService,
    private routerDatabase: RouterDatabaseService,
  ) {}

  @Get('vendors')
  @ApiOperation({ summary: 'List every vendor in the capability database (Router Database)' })
  async listVendors() {
    return this.routerDatabase.listVendors();
  }

  @Get(':gatewayId/features')
  @ApiOperation({ summary: 'Supported Features for the router detected on this gateway' })
  async getFeatures(@CurrentUser('sub') parentId: string, @Param('gatewayId') gatewayId: string) {
    return this.routerIntegrationService.getFeatures(parentId, gatewayId);
  }

  @Post(':gatewayId/setup')
  @ApiOperation({ summary: 'One-Click Setup / Router Wizard — save admin credentials and test the connection' })
  async setup(
    @CurrentUser('sub') parentId: string,
    @Param('gatewayId') gatewayId: string,
    @Body() dto: RouterSetupDto,
  ) {
    return this.routerIntegrationService.setup(parentId, gatewayId, dto);
  }

  @Post(':gatewayId/test-connection')
  @ApiOperation({ summary: 'Re-test the router connection (Diagnostics)' })
  async testConnection(@CurrentUser('sub') parentId: string, @Param('gatewayId') gatewayId: string) {
    return this.routerIntegrationService.testConnection(parentId, gatewayId);
  }

  @Post(':gatewayId/detect')
  @ApiOperation({ summary: 'Trigger an immediate router re-scan (Router Detection "Scan Now")' })
  async triggerDetection(@CurrentUser('sub') parentId: string, @Param('gatewayId') gatewayId: string) {
    return this.routerIntegrationService.triggerDetection(parentId, gatewayId);
  }

  @Get(':gatewayId/diagnostics')
  @ApiOperation({ summary: 'Detected router info + recent router-command history' })
  async getDiagnostics(@CurrentUser('sub') parentId: string, @Param('gatewayId') gatewayId: string) {
    return this.routerIntegrationService.getDiagnostics(parentId, gatewayId);
  }

  @Post(':gatewayId/end-gaming-session')
  @ApiOperation({ summary: 'Instant Block — SmartBlockEngine picks the best supported strategy' })
  async endGamingSession(
    @CurrentUser('sub') parentId: string,
    @Param('gatewayId') gatewayId: string,
    @Body() dto: EndGamingSessionDto,
  ) {
    return this.smartBlockEngine.endGamingSession(parentId, gatewayId, dto.deviceId);
  }

  @Post(':gatewayId/change-dns')
  @ApiOperation({ summary: 'Change the router\'s DNS server' })
  async changeDns(
    @CurrentUser('sub') parentId: string,
    @Param('gatewayId') gatewayId: string,
    @Body() dto: ChangeDnsDto,
  ) {
    return this.routerIntegrationService.changeDns(parentId, gatewayId, dto.dnsServer);
  }

  @Post(':gatewayId/block-mac')
  @ApiOperation({ summary: 'Block a device by MAC address at the router' })
  async blockMac(
    @CurrentUser('sub') parentId: string,
    @Param('gatewayId') gatewayId: string,
    @Body() dto: RouterMacActionDto,
  ) {
    return this.routerIntegrationService.blockMac(parentId, gatewayId, dto.macAddress);
  }

  @Post(':gatewayId/unblock-mac')
  @ApiOperation({ summary: 'Unblock a device by MAC address at the router' })
  async unblockMac(
    @CurrentUser('sub') parentId: string,
    @Param('gatewayId') gatewayId: string,
    @Body() dto: RouterMacActionDto,
  ) {
    return this.routerIntegrationService.unblockMac(parentId, gatewayId, dto.macAddress);
  }
}
