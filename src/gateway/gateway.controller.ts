import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GatewayTokenGuard } from '../common/guards/gateway-token.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
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
}

class GatewayDiscoveryDto {
  @ApiProperty({ type: [GatewayDiscoveryDeviceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GatewayDiscoveryDeviceDto)
  devices: GatewayDiscoveryDeviceDto[];
}

@ApiTags('Gateway')
@Controller('gateway')
export class GatewayController {
  constructor(private gatewayService: GatewayService) {}

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
    return this.gatewayService.getPolicies(req.gateway.id);
  }

  @Post('discovery')
  @UseGuards(GatewayTokenGuard)
  @ApiOperation({ summary: 'Report ARP/neighbour device discovery from gateway agent' })
  async reportDiscovery(@Req() req: any, @Body() dto: GatewayDiscoveryDto) {
    return this.gatewayService.updateDiscoveredDevices(req.gateway.id, dto.devices ?? []);
  }
}
