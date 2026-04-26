import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EnforcementService } from './enforcement.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class BlockDeviceDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;

  @ApiProperty()
  @IsString()
  reason: string;
}

class UnblockDeviceDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;
}

class SyncRulesDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;
}

@ApiTags('Enforcement')
@Controller('enforcement')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EnforcementController {
  constructor(private enforcementService: EnforcementService) {}

  @Post('block')
  @ApiOperation({ summary: 'Block a device' })
  async block(@Body() dto: BlockDeviceDto) {
    return this.enforcementService.blockDevice(dto.deviceId, dto.reason);
  }

  @Post('unblock')
  @ApiOperation({ summary: 'Unblock a device' })
  async unblock(@Body() dto: UnblockDeviceDto) {
    return this.enforcementService.unblockDevice(dto.deviceId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync rules to device' })
  async sync(@Body() dto: SyncRulesDto) {
    return this.enforcementService.syncRules(dto.deviceId);
  }
}
