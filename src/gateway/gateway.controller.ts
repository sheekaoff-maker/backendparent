import { Controller, Post, Get, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GatewayTokenGuard } from '../common/guards/gateway-token.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsUUID, IsArray, IsInt, Min, Max, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class RegisterGatewayDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endpoint?: string;
}

class PairGatewayDto {
  @ApiProperty()
  @IsUUID()
  gatewayId: string;
}

class GatewayBlockDto {
  @ApiProperty()
  @IsString()
  deviceMac: string;
}

class GatewayDiscoveryDeviceDto {
  @ApiProperty()
  @IsString()
  ipAddress: string;

  @ApiProperty()
  @IsString()
  macAddress: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dhcpClientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorOui?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  osHint?: string;
}

class GatewayDiscoveryDto {
  @ApiProperty({ type: [GatewayDiscoveryDeviceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GatewayDiscoveryDeviceDto)
  devices: GatewayDiscoveryDeviceDto[];
}

class VpnDetectionDto {
  @ApiProperty()
  @IsString()
  deviceId: string;

  @ApiProperty()
  @IsString()
  provider: string;

  @ApiProperty()
  @IsString()
  method: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detail?: string;

  // Per-signal strength (0-100) — see gateway-agent's vpn-patterns.js for
  // how each is assigned. Optional: older gateway-agent builds don't send
  // this and detections without it are still recorded.
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidence?: number;

  // Noisy-OR combination of every signal that fired for this device this
  // cycle — see vpn-detector.js's computeConfidence(). Same field on every
  // detection row for a given device+cycle.
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  overallConfidence?: number;
}

class VpnDetectionReportDto {
  @ApiProperty({ type: [VpnDetectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VpnDetectionDto)
  detections: VpnDetectionDto[];
}

// Same shape as VpnDetectionDto — kept as a distinct class (not a type
// alias) so Swagger documents it under its own name and either DTO can
// diverge later without affecting the other.
class DohDetectionDto {
  @ApiProperty()
  @IsString()
  deviceId: string;

  @ApiProperty()
  @IsString()
  provider: string;

  @ApiProperty()
  @IsString()
  method: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detail?: string;

  // Per-signal strength (0-100) — see gateway-agent's doh-detector.js for
  // how each detection method is weighted. Optional: older gateway-agent
  // builds don't send this and detections without it are still recorded.
  // Unlike VpnDetectionDto there is no combined overallConfidence field —
  // DoH detections are reported and audit-logged independently rather than
  // aggregated per device-cycle.
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidence?: number;
}

class DohDetectionReportDto {
  @ApiProperty({ type: [DohDetectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DohDetectionDto)
  detections: DohDetectionDto[];
}

@ApiTags('Gateway')
@Controller('gateway')
export class GatewayController {
  constructor(private gatewayService: GatewayService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List gateways owned by the current parent' })
  async list(@CurrentUser('sub') parentId: string) {
    return this.gatewayService.listGateways(parentId);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new gateway' })
  async register(@CurrentUser('sub') parentId: string, @Body() dto: RegisterGatewayDto) {
    return this.gatewayService.register(parentId, dto.name, dto.endpoint);
  }

  @Post('pair')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pair gateway with parent' })
  async pair(@CurrentUser('sub') parentId: string, @Body() dto: PairGatewayDto) {
    return this.gatewayService.pair(dto.gatewayId, parentId);
  }

  @Get('devices')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'List discovered devices (gateway token auth)' })
  async getDevices(@Query('gatewayId') gatewayId: string) {
    return this.gatewayService.getDiscoveredDevices(gatewayId);
  }

  @Post('block')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Block device via gateway' })
  async block(@Query('gatewayId') gatewayId: string, @Body() dto: GatewayBlockDto) {
    return this.gatewayService.blockDevice(gatewayId, dto.deviceMac);
  }

  @Post('unblock')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Unblock device via gateway' })
  async unblock(@Query('gatewayId') gatewayId: string, @Body() dto: GatewayBlockDto) {
    return this.gatewayService.unblockDevice(gatewayId, dto.deviceMac);
  }

  @Get('status')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Get gateway status' })
  async getStatus(@Query('gatewayId') gatewayId: string) {
    return this.gatewayService.getStatus(gatewayId);
  }

  @Get('policies')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Get gateway enforcement policies for local firewall agent' })
  async getPolicies(@Req() req: any) {
    return this.gatewayService.getPolicies(req.gateway.id, Boolean(req.usedPreviousToken));
  }

  @Post(':gatewayId/rotate-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rotate a gateway\'s auth token (old token stays valid for a grace period so a deployed agent is never locked out)' })
  async rotateToken(@CurrentUser('sub') parentId: string, @Param('gatewayId') gatewayId: string) {
    return this.gatewayService.rotateToken(parentId, gatewayId);
  }

  @Post('discovery')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Report ARP/neighbour device discovery from gateway agent' })
  async reportDiscovery(@Req() req: any, @Body() dto: GatewayDiscoveryDto) {
    return this.gatewayService.updateDiscoveredDevices(req.gateway.id, dto.devices ?? []);
  }

  @Post('vpn-detections')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Report VPN-signature detections (Layer 5) from gateway agent' })
  async reportVpnDetections(@Req() req: any, @Body() dto: VpnDetectionReportDto) {
    return this.gatewayService.recordVpnDetections(req.gateway.id, dto.detections ?? []);
  }

  @Post('doh-detections')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Report DoH/DoT (encrypted DNS) detections (Layer 8) from gateway agent' })
  async reportDohDetections(@Req() req: any, @Body() dto: DohDetectionReportDto) {
    return this.gatewayService.recordDohDetections(req.gateway.id, dto.detections ?? []);
  }
}
